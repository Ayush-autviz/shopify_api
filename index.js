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
                            variants(first: 10) {
                                edges {
                                   node {
                                         id
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
              quantity: ${quantity}
              merchandiseId: "${merchandiseId}"
            }
          ],
          buyerIdentity: {
            email: "${email}",
            countryCode: ${country},
            deliveryAddressPreferences: {
              oneTimeUse: false,
              deliveryAddress: {
                address1: "${address1}",
                address2: "${address2}",
                city: "${city}",
                province: "${province}",
                country: "${country}",
                zip: "${zip}"
              }
            },
            preferences: {
              delivery: {
                deliveryMethod: ${deliveryMethod}
              }
            }
          },
          attributes: {
            key: "${cartAttributeKey}",
            value: "${cartAttributeValue}"
          }
        }
      ) {
        cart {
          id
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

// add cart line
app.post("/add-cart-line", async (req, res) => {
  const { cartId, lines } = req.body;

  const linesInput = lines.map(line => {
 //   const attributes = line.attributes.map(attr => `{ key: "${attr.key}", value: "${attr.value}" }`).join(', ');
    return `{
      merchandiseId: "${line.merchandiseId}",
      quantity: ${line.quantity},
    }`;
  }).join(', ');

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

  const lineIdsInput = lineIds.map(id => `"${id}"`).join(', ');

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
                      id
                      title
                  }
              }
              }
          }`,
  });

  res.send(products);
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

app.listen(port, () => console.log(`Listening at http://localhost:${port}`));
