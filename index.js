const express = require("express");
require("dotenv").config();
require("@shopify/shopify-api/adapters/node");
const { shopifyApi, LATEST_API_VERSION } = require("@shopify/shopify-api");
const fetch = require("node-fetch");

const shopify = shopifyApi({
  apiKey: process.env.CLIENT_ID,
  apiSecretKey: process.env.CLIENT_KEY,
  scopes: ["read_products"],
  hostName: process.env.HOST_NAME,
});
console.log(shopify, "shopify");
const storefrontAccessToken = process.env.STOREFRONT_ACCESS_TOKEN;
const shop = process.env.STORE_URL;

const storefrontClient = new shopify.clients.Storefront({
  session: {
    shop: shop,
    accessToken: storefrontAccessToken,
  },
});

const app = express();

app.use(express.json());
const port = 3000;

//request to get all the products

app.get("/", async (req, res) => {
  const products = await storefrontClient.query({
    data: `{
            products (first: 10) {
            edges {
                node {
                    id
                    title
                            images(first: 10) {
          edges {
            node {
              src
              originalSrc
            }
          }
        }
                  options(first: 10) {
          id
          name
          values
        }
                    variants(first: 10) {
                                edges {
                                   node {
                                         id
                                         title
                                                       availableForSale
              currentlyNotInStock
                            selectedOptions {
                name
                value
              }

                                                       price {
                amount
              }
                                        }
                                       }
                                                }
                      }
                   }
            }
        }`,
  });

  res.send(products);
});

//create customer acess token

app.post("/create-customer-token", async (req, res) => {
  const { email, password } = req.body;

  const query = `
    mutation {
      customerAccessTokenCreate(input: {email: "${email}", password: "${password}"}) {
        customerAccessToken {
          accessToken
        }
        customerUserErrors {
          message
        }
      }
    }
  `;

  try {
    const response = await storefrontClient.query({ data: query });
    console.log(response.body, "bodydouble");
    // if (response.errors) {
    //   throw new Error(response.errors.map((error) => error.message).join(", "));
    // }

    const { customerAccessTokenCreate } = response.body.data;
    const { customerAccessToken, customerUserErrors } =
      customerAccessTokenCreate;

    if (customerUserErrors.length > 0) {
      throw new Error(
        customerUserErrors.map((error) => error.message).join(", ")
      );
    }

    res.send({ customerAccessToken });
  } catch (error) {
    console.error(error);

    res.status(500).send(error);
  }
});

// API endpoint to delete address
app.post("/delete-customer-address", async (req, res) => {
  const { customerAccessToken, id } = req.body;

  const query = `
    mutation customerAddressDelete($customerAccessToken: String!, $id: ID!) {
      customerAddressDelete(customerAccessToken: $customerAccessToken, id: $id) {
        customerUserErrors {
          field
          message
        }
        deletedCustomerAddressId
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    customerAccessToken,
    id,
  };

  try {
    const response = await storefrontClient.query({
      data: {
        query,
        variables,
      },
    });

    const { customerAddressDelete } = response.body.data;
    const { customerUserErrors, userErrors, deletedCustomerAddressId } =
      customerAddressDelete;

    if (customerUserErrors.length > 0 || userErrors.length > 0) {
      const errors = [...customerUserErrors, ...userErrors]
        .map((error) => error.message)
        .join(", ");
      throw new Error(errors);
    }

    res.send({ deletedCustomerAddressId });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: error.message });
  }
});

//customer details
app.post("/customer-details", async (req, res) => {
  const { customerAccessToken } = req.body;

  const query = `
    query customerDetails($customerAccessToken: String!) {
      customer(customerAccessToken: $customerAccessToken) {
        addresses(first: 10) {
          edges {
            node {
              id
              firstName
              lastName
              name
              phone
              province
              zip
              country
              city
              address2
              address1
            }
          }
        }
        displayName
        email
        firstName
        lastName
        phone
        defaultAddress {
          address1
          address2
          city
          country
          firstName
          id
          lastName
          name
          province
          phone
          zip
        }
        orders(first: 10) {
          edges {
            node {
              statusUrl
              totalPrice {
                amount
              }
              lineItems(first: 10) {
                edges {
                  node {
                    title
                    variant {
                      image {
                        originalSrc
                        src
                      }
                      price {
                        amount
                      }
                      product {
                        title
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const variables = {
    customerAccessToken,
  };

  try {
    const response = await storefrontClient.query({
      data: {
        query,
        variables,
      },
    });

    const { customer } = response.body.data;

    if (!customer) {
      throw new Error("Customer not found");
    }

    res.send(customer);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: error.message });
  }
});

//add customer address

app.post("/add-customer-address", async (req, res) => {
  const { address, customerAccessToken } = req.body;

  const query = `
    mutation customerAddressCreate($address: MailingAddressInput!, $customerAccessToken: String!) {
      customerAddressCreate(address: $address, customerAccessToken: $customerAccessToken) {
        customerAddress {
          id
          address1
          address2
          city
          company
          country
          firstName
          lastName
          phone
          province
          zip
        }
        customerUserErrors {
          field
          message
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    address,
    customerAccessToken,
  };

  try {
    const response = await storefrontClient.query({
      data: {
        query,
        variables,
      },
    });

    const { customerAddressCreate } = response.body.data;
    const { customerAddress, customerUserErrors, userErrors } =
      customerAddressCreate;

    if (customerUserErrors.length > 0 || userErrors.length > 0) {
      const errors = [...customerUserErrors, ...userErrors]
        .map((error) => error.message)
        .join(", ");
      throw new Error(errors);
    }

    res.send({ customerAddress });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: error.message });
  }
});

//menu
// app.get("/menu", async (req, res) => {
//   try {
//     const menuInfo = await storefrontClient.query({
//       data: {
//         query: `
//                 {
//                   menu(handle: "main-menu") {
//                     title

//                     items {
//                        title
//                       resource {
//                         ... on Collection {
//                           id
//                           title
//                           products(first: 10) {
//                             edges {
//                               node {
//                                 images(first: 10) {
//                                   edges {
//                                     node {
//                                       originalSrc
//                                       src
//                                     }
//                                   }
//                                 }
//                                 availableForSale
//                                 options(first: 10) {
//                                   optionValues {
//                                     id
//                                     name
//                                   }
//                                   name
//                                   values
//                                 }
//                                 title
//                             variants(first: 10) {
//                               edges {
//                                 node {
//                                   id
//                                   title
//                                   availableForSale
//                                   currentlyNotInStock
//                                   selectedOptions {
//                                     name
//                                     value
//                                   }
//                                   price {
//                                     amount
//                                   }
//                                 }
//                               }
//                             }
//                               }
//                             }
//                           }
//                         }
//                       }
//                     }
//                   }
//                 }
//           `,
//       },
//     });

//     res.send(menuInfo);
//   } catch (error) {
//     console.error(error);
//     res.status(500).send({
//       error: "An error occurred while fetching the menu information.",
//     });
//   }
// });

app.get("/menu", async (req, res) => {
  try {
    const menuInfo = await storefrontClient.query({
      data: {
        query: `
          {
            menu(handle: "main-menu") {
              title
              items {
                title
                resource {
                  ... on Product {
                    id
                  }
                }
                items {
                  title
                  resource {
                    ... on Product {
                      id
                    }
                  }
                  items {
                    title
                    resource {
                      ... on Product {
                        id
                      }
                    }
                    items {
                      title
                      resource {
                        ... on Product {
                          id
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        `,
      },
    });

    res.send(menuInfo);
  } catch (error) {
    console.error(error);
    res.status(500).send({
      error: "An error occurred while fetching the menu information.",
    });
  }
});


//forgot password

app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  const query = `
    mutation {
      customerRecover(email: "${email}") {
        customerUserErrors {
          message
        }
      }
    }
  `;

  try {
    const response = await storefrontClient.query({ data: query });
    console.log(response.body, "bodydouble");

    const { customerRecover } = response.body.data;
    const { customerUserErrors } = customerRecover;

    if (customerUserErrors.length > 0) {
      throw new Error(
        customerUserErrors.map((error) => error.message).join(", ")
      );
    }

    res.send({ message: "Recovery email sent successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});

// customer details

app.get("/customer", async (req, res) => {
  const customerAccessToken = req.query.token; // Assuming you pass the token as a query parameter
  try {
    const customerDetails = await storefrontClient.query({
      data: `{
        customer(customerAccessToken: "${customerAccessToken}") {
          displayName
          orders(first: 10) {
            edges {
              node {
                name
                orderNumber
                totalPrice {
                  amount
                }
              }
            }
          }
        }
      }`,
    });
    res.send(customerDetails.body.data.customer);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// creating customer

app.post("/create-customer", async (req, res) => {
  const { firstName, lastName, email, phone, password, acceptsMarketing } =
    req.body;

  const query = `
    mutation {
      customerCreate(input: {
        firstName: "${firstName}",
        lastName: "${lastName}",
        email: "${email}",
        phone: "${phone}",
        password: "${password}",
        acceptsMarketing: ${acceptsMarketing}
      }) {
        customer {
          firstName
          lastName
          email
          phone
          acceptsMarketing
        }
        customerUserErrors {
          field
          message
          code
        }
      }
    }
  `;

  try {
    const response = await storefrontClient.query({ data: query });

    const { customerCreate } = response.body.data;
    const { customer, customerUserErrors } = customerCreate;

    if (customerUserErrors.length > 0) {
      throw new Error(
        customerUserErrors.map((error) => error.message).join(", ")
      );
    }

    res.send({ customer });
  } catch (error) {
    console.error(error);

    res.status(500).send(error);
  }
});
// create cart

// buyerIdentity: {
//   email: "${email}",
//   countryCode: ${country},
//   deliveryAddressPreferences: {
//     oneTimeUse: false,
//     deliveryAddress: {
//       address1: "${address1}",
//       address2: "${address2}",
//       city: "${city}",
//       province: "${province}",
//       country: "${country}",
//       zip: "${zip}"
//     }
//   },
// },

app.post("/create-cart", async (req, res) => {
  const {
    email,
    quantity,
    merchandiseId,
    address1,
    address2,
    city,
    province,
    country,
    zip,
    deliveryMethod,
    cartAttributeKey,
    cartAttributeValue,
  } = req.body;

  const query = `
    mutation {
      cartCreate(
        input: {
          lines: [
          { 
          quantity: 1
          merchandiseId: "gid://shopify/ProductVariant/39927659364523"
          }
          ],
        }
      ) {
        cart {
          id
          checkoutUrl
          createdAt
          updatedAt
          lines(first: 10) {
            edges {
              node {
                id
                merchandise {
                  ... on ProductVariant {
                    id
                  }
                }
              }
            }
          }
          buyerIdentity {
            deliveryAddressPreferences {
              __typename
            }
            preferences {
              delivery {
                deliveryMethod
              }
            }
          }
          attributes {
            key
            value
          }
          cost {
            totalAmount {
              amount
              currencyCode
            }
            subtotalAmount {
              amount
              currencyCode
            }
            totalTaxAmount {
              amount
              currencyCode
            }
            totalDutyAmount {
              amount
              currencyCode
            }
          }
        }
      }
    }
  `;

  try {
    const response = await storefrontClient.query({ data: query });

    const { cartCreate } = response.body.data;
    const { cart } = cartCreate;

    res.send({ cart });
  } catch (error) {
    console.error(error);

    res.status(500).send(error);
  }
});

// update buyers identity

app.post("/update-buyer-identity", async (req, res) => {
  const {
    email,
    country,
    address1,
    address2,
    city,
    province,
    zip,
    cartId,
    phone,
  } = req.body;

  const query = `
    mutation cartBuyerIdentityUpdate($buyerIdentity: CartBuyerIdentityInput!, $cartId: ID!) {
      cartBuyerIdentityUpdate(buyerIdentity: $buyerIdentity, cartId: $cartId) {
        cart {
          id
          checkoutUrl
          totalQuantity
          attributes {
            key
            value
          }
          buyerIdentity {
            email
            phone
            countryCode
            deliveryAddressPreferences {
              customerAddressId
              deliveryAddress {
                address1
                address2
                city
                country
                firstName
                lastName
                phone
                province
                zip
              }
            }
          }
          lines(first: 10) {
            edges {
              node {
                id
                quantity
                merchandise {
                  ... on ProductVariant {
                    id
                    title
                    product {
                      title
                    }
                  }
                }
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    buyerIdentity: {
      email: email,
      phone: phone,
      countryCode: country,
      deliveryAddressPreferences: [
        {
          deliveryAddress: {
            address1: address1,
            address2: address2,
            city: city,
            province: province,
            country: country,
            zip: zip,
          },
        },
      ],
    },
    cartId: cartId,
  };

  try {
    const response = await storefrontClient.query({
      data: {
        query,
        variables,
      },
    });

    const { cartBuyerIdentityUpdate } = response.body.data;
    const { cart, userErrors } = cartBuyerIdentityUpdate;

    if (userErrors.length > 0) {
      const errors = userErrors.map((error) => error.message).join(", ");
      throw new Error(errors);
    }

    res.send({ cart });
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});

// request to update the cart

app.post("/update-cart-line", async (req, res) => {
  const { cartId, lineId, quantity } = req.body;

  const query = `
    mutation {
      cartLinesUpdate(
        cartId: "${cartId}"
        lines: {
          id: "${lineId}"
          quantity: ${quantity}
        }
      ) {
        cart {
          id
          lines(first: 10) {
            edges {
              node {
                id
                quantity
                merchandise {
                  ... on ProductVariant {
                    id
                  }
                }
              }
            }
          }
          cost {
            totalAmount {
              amount
              currencyCode
            }
            subtotalAmount {
              amount
              currencyCode
            }
            totalTaxAmount {
              amount
              currencyCode
            }
            totalDutyAmount {
              amount
              currencyCode
            }
          }
        }
      }
    }
  `;

  try {
    const response = await storefrontClient.query({ data: query });

    const { cartLinesUpdate } = response.body.data;
    const { cart } = cartLinesUpdate;

    res.send({ cart });
  } catch (error) {
    console.error(error);

    res.status(500).send(error);
  }
});

//search

app.get("/search", async (req, res) => {
  // Extract the search term from query parameters
  const searchTerm = req.query.query; // Default to "hurst" if not provided

  try {
    const data = await storefrontClient.query({
      data: `query MyQuery {
        search(query: "${searchTerm}", first: 10) {
          edges {
            node {
              ... on Product {
                id
                title
                images(first: 10) {
                  edges {
                    node {
                      originalSrc
                      src
                    }
                  }
                }
                options(first: 10) {
                  id
                  name
                  values
                }
                variants(first: 10) {
                  edges {
                    node {
                      availableForSale
                      id
                      title
                      currentlyNotInStock
                      selectedOptions {
                        name
                        value
                      }
                      price {
                        amount
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }`,
    });

    console.log(data, "data");

    res.send(data);
  } catch (error) {
    console.error("Error fetching search results:", error);
    res.status(500).send({ error: "Failed to fetch search results" });
  }
});

// add cart line
app.post("/add-cart-line", async (req, res) => {
  const { cartId, lines } = req.body;

  console.log(req.body);

  const linesInput = lines
    .map((line) => {
      //   const attributes = line.attributes.map(attr => `{ key: "${attr.key}", value: "${attr.value}" }`).join(', ');
      return `{
      merchandiseId: "${line.merchandiseId}",
      quantity: ${line.quantity},
    }`;
    })
    .join(", ");

  const query = `
    mutation {
      cartLinesAdd(cartId: "${cartId}", lines: [${linesInput}]) {
        cart {
          id
          lines(first: 10) {
            edges {
              node {
                id
                quantity
                merchandise {
                  ... on ProductVariant {
                    id
                  }
                }
              }
            }
          }
          cost {
            totalAmount {
              amount
              currencyCode
            }
            subtotalAmount {
              amount
              currencyCode
            }
            totalTaxAmount {
              amount
              currencyCode
            }
            totalDutyAmount {
              amount
              currencyCode
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    const response = await storefrontClient.query({ data: query });

    const { cartLinesAdd } = response.body.data;
    const { cart, userErrors } = cartLinesAdd;

    if (userErrors.length > 0) {
      throw new Error(userErrors.map((error) => error.message).join(", "));
    }

    res.send({ cart });
  } catch (error) {
    console.error(error);

    res.status(500).send({ error: error.message });
  }
});

// request to get the single product

app.get("/product", async (req, res) => {
  const products = await storefrontClient.query({
    data: `{
         product(id: "gid://shopify/Product/8513647018147") {
         availableForSale
         description
         title
    }
    }`,
  });
  res.send(products);
});




// remove cart line

app.post("/remove-cart-line", async (req, res) => {
  const { cartId, lineIds } = req.body;
  console.log(cartId, "cartId");

  const lineIdsInput = lineIds?.map((id) => `"${id}"`).join(", ");
  console.log(lineIdsInput, "lineidInput");
  const query = `
    mutation {
      cartLinesRemove(cartId: "${cartId}", lineIds: [${lineIdsInput}]) {
        cart {
          id
          lines(first: 10) {
            edges {
              node {
                id
                quantity
                merchandise {
                  ... on ProductVariant {
                    id
                  }
                }
              }
            }
          }
          cost {
            totalAmount {
              amount
              currencyCode
            }
            subtotalAmount {
              amount
              currencyCode
            }
            totalTaxAmount {
              amount
              currencyCode
            }
            totalDutyAmount {
              amount
              currencyCode
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    const response = await storefrontClient.query({ data: query });

    const { cartLinesRemove } = response.body.data;
    const { cart, userErrors } = cartLinesRemove;

    if (userErrors.length > 0) {
      throw new Error(userErrors.map((error) => error.message).join(", "));
    }

    res.send({ cart });
  } catch (error) {
    console.error(error);

    res.status(500).send({ error: error.message });
  }
});

// request of all categories

app.get("/collection", async (req, res) => {
  const products = await storefrontClient.query({
    data: `{
              collections (first: 20) {
              edges {
                  node {
                      handle
                      id
                      title
                  }
              }
              }
          }`,
  });

  res.send(products);
});


app.get("/collections", async (req, res) => {
  const { handle, after } = req.query;  // Assuming the collection handle is passed as a query parameter
  console.log(after,'after')

  try {
    const products = await storefrontClient.query({
      data: `
        {
          collection(handle: "${handle}") {
            products(first: 10, after: ${after ? `"${after}"` : null}) {
              pageInfo {
                hasNextPage
                hasPreviousPage
                startCursor
                endCursor
              }
            edges {
                node {
                    id
                    title
                            images(first: 10) {
          edges {
            node {
              src
              originalSrc
            }
          }
        }
                  options(first: 10) {
          id
          name
          values
        }
                    variants(first: 10) {
                                edges {
                                   node {
                                         id
                                         title
                                                       availableForSale
              currentlyNotInStock
                            selectedOptions {
                name
                value
              }

                                                       price {
                amount
              }
                                        }
                                       }
                                                }
                      }
                   }
            }
            
          }
        }
      `,
    });

    res.send(products);
  } catch (error) {
    res.status(500).send({ error: "An error occurred while fetching the collection." });
  }
});


// retrive the cart

app.get("/retrieve-cart", async (req, res) => {
  const { cartId } = req.query;

  const query = `
    query {
      cart(id: "${cartId}") {
        id
        createdAt
        updatedAt
        lines(first: 10) {
          edges {
            node {
              id
              quantity
              merchandise {
                ... on ProductVariant {
                  id
                title
                image {
                  originalSrc
                  src
                }
                selectedOptions {
                  name
                  value
                }
                                    price {
                    amount
                    currencyCode
                  }

                  product {
                    id
                    title
                    images(first: 1) {
                      edges {
                        node {
                          src
                        }
                      }
                    }
                  }
                }
              }
              attributes {
                key
                value
              }
            }
          }
        }
        attributes {
          key
          value
        }
        cost {
          totalAmount {
            amount
            currencyCode
          }
          subtotalAmount {
            amount
            currencyCode
          }
          totalTaxAmount {
            amount
            currencyCode
          }
          totalDutyAmount {
            amount
            currencyCode
          }
        }
        buyerIdentity {
          email
          phone
          customer {
            id
          }
          countryCode
          deliveryAddressPreferences {
            ... on MailingAddress {
              address1
              address2
              city
              provinceCode
              countryCodeV2
              zip
            }
          }
          preferences {
            delivery {
              deliveryMethod
            }
          }
        }
      }
    }
  `;

  try {
    const response = await storefrontClient.query({ data: query });

    const { cart } = response.body.data;

    res.send({ cart });
  } catch (error) {
    console.error(error);

    res.status(500).send({ error: error.message });
  }
});

// request to single category

app.get("/category", async (req, res) => {
  try {
    const products = await storefrontClient.query({
      data: {
        query: `
            {
              collection(id: "gid://shopify/Collection/307595509923") {
                title
                products(first: 10) {
                  edges {
                    node {
                      id
                      title
                    }
                  }
                }
              }
            }
          `,
      },
    });

    res.send(products);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send({ error: "An error occurred while fetching products." });
  }
});

app.get("/shop-info", async (req, res) => {
  try {
    const shopInfo = await storefrontClient.query({
      data: {
        query: `
            {
              shop {
                name
                description
                brand {
                  shortDescription
                  slogan
                  squareLogo {
                    image {
                      src
                      url
                      originalSrc
                    }
                  }
                  logo {
                    previewImage {
                      src
                      url
                      altText
                      height
                      id
                      originalSrc
                      width
                    }
                    alt
                    id
                    image {
                      url
                      src
                      originalSrc
                      altText
                      height
                      id
                      transformedSrc
                    }
                    mediaContentType
                    presentation {
                      asJson(format: MODEL_VIEWER)
                      id
                    }
                  }
                  colors {
                    primary {
                      background
                      foreground
                    }
                    secondary {
                      background
                      foreground
                    }
                  }
                  coverImage {
                    previewImage {
                      altText
                      height
                      id
                      originalSrc
                      src
                      url
                    }
                    alt
                    id
                    image {
                      height
                      altText
                      id
                      originalSrc
                      src
                      url
                      width
                    }
                    mediaContentType
                    presentation {
                      asJson(format: MODEL_VIEWER)
                      id
                    }
                  }
                }
                refundPolicy {
                  body
                  title
                  url
                  handle
                }
                privacyPolicy {
                  handle
                  body
                  title
                  url
                }
               
                termsOfService {
                  title
                  url
                  handle
                  body
                }
              }
            }
          `,
      },
    });

    res.send(shopInfo);
  } catch (error) {
    console.error(error);
    res.status(500).send({
      error: "An error occurred while fetching the shop information.",
    });
  }
});

app.get("/checkout-url", async (req, res) => {
  const { cartId } = req.query;

  const query = `
    query {
      cart(id: "${cartId}") {
        checkoutUrl
      }
    }
  `;

  try {
    const response = await storefrontClient.query({ data: query });

    const { cart } = response.body.data;

    res.send({ checkoutUrl: cart.checkoutUrl });
  } catch (error) {
    console.error(error);

    res.status(500).send({ error: error.message });
  }
});

app.get("/square-logo", async (req, res) => {
  try {
    const squareLogoInfo = await storefrontClient.query({
      data: {
        query: `
                {
                  shop {
                    name
                    brand {
                      logo {
                          image {
                          url
                        }
                        alt
                      }
                    }
                  }
                }
          `,
      },
    });

    res.send(squareLogoInfo);
  } catch (error) {
    console.error(error);
    res.status(500).send({
      error: "An error occurred while fetching the square logo information.",
    });
  }
});

app.get("/product-types", async (req, res) => {
  try {
    const productTypesInfo = await storefrontClient.query({
      data: {
        query: `
                {
                  productTypes(first: 10) {
                    edges {
                      node
                    }
                  }
                }
          `,
      },
    });

    res.send(productTypesInfo);
  } catch (error) {
    console.error(error);
    res.status(500).send({
      error: "An error occurred while fetching the product types.",
    });
  }
});

app.listen(port, () => console.log(`Listening at http://localhost:${port}`));
