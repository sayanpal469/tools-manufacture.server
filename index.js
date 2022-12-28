const {
    MongoClient,
    ServerApiVersion,
    ObjectId
} = require('mongodb');
const express = require('express');
const app = express()
const cors = require('cors');
const jwt = require('jsonwebtoken')
const {
    use
} = require('express/lib/application');
const port = process.env.PORT || 5000;
require('dotenv').config()

const stripe = require('stripe')(process.env.STRIP_SECRET_KEY)

// Middleware
app.use(express.json())
app.use(cors())

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({
            message: 'UnAuthorized access'
        });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({
                message: 'Forbidden access'
            })
        }
        req.decoded = decoded;
        next();
    });
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.laxvf.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1
});

async function run() {
    try {
        await client.connect()
        const toolsCollection = client.db('Jantrick').collection('tools')
        const userCollection = client.db('Jantrick').collection('user')
        const ordersCollection = client.db('Jantrick').collection('myOrders')
        const reviewsCollection = client.db('Jantrick').collection('reviews')
        const paymentCollection = client.db('Jantrick').collection('payment')

        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({
                email: requester
            });
            if (requesterAccount.role === 'admin') {
                const filter = {
                    email: email
                };
                const updateDoc = {
                    $set: {
                        role: 'admin'
                    },
                };
                const result = await userCollection.updateOne(filter, updateDoc);
                res.send(result)
            } else {
                res.status(403).send({
                    message: 'Forbidden'
                })
            }

        })


        app.post('/create-payment-intent', async (req, res) => {
            const order = req.body;
            const price = order.totalPrice
            console.log(price)
            const amount = parseInt(price) * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'inr',
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })



        app.patch('/paymentOrder/:id', async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            console.log(payment);
            const filter = {
                _id: ObjectId(id)
            };
            const updateDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId,
                    status: 'pending'
                }
            }
            const updatedOrder = await ordersCollection.updateOne(filter, updateDoc)
            const result = await paymentCollection.insertOne(updatedOrder)

            res.send(updateDoc)
        })





        app.get('/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({
                email: email
            })
            const isAdmin = user.role === 'admin';
            res.send({
                admin: isAdmin
            })

        })


        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            console.log(user);
            const filter = {
                email: email
            };
            const options = {
                upsert: true
            };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options)
            const token = jwt.sign({
                email: email
            }, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1h'
            })
            //console.log(token, result);
            res.send({
                result,
                token
            })
        })

        app.get('/user', async (req, res) => {
            const query = {};
            const users = await userCollection.find(query).toArray();
            res.send(users)
        })


        app.delete('/user/:email', async (req, res) => {
            const email = req.params.email;
            const query = {
                email: email
            };
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })

        app.post('/tools', async (req, res) => {
            const addTools = req.body;
            const result = await toolsCollection.insertOne(addTools)
            res.send(result)
        })

        app.get('/tools', async (req, res) => {
            const query = {};
            const tools = await toolsCollection.find(query).toArray();
            res.send(tools);
        })

        app.get('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const query = {
                _id: ObjectId(id)
            };
            const tool = await toolsCollection.findOne(query);
            res.send(tool);
        })

        app.delete('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const query = {
                _id: ObjectId(id)
            }
            const result = await toolsCollection.deleteOne(query)
            res.send(result)
        })

        app.get('/orders', async (req, res) => {
            const query = {};
            const orders = await ordersCollection.find(query).toArray();
            res.send(orders);
        })

        app.post('/orders', async (req, res) => {
            const myOrders = req.body;
            const result = await ordersCollection.insertOne(myOrders);
            res.send(result);
        })



        app.get('/orders/:email', async (req, res) => {
            const email = req.params.email;
            const query = {
                email: email
            };
            const myOrders = await ordersCollection.find(query).toArray();
            res.send(myOrders);
        })


        app.delete('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const query = {
                _id: ObjectId(id)
            };
            const result = await ordersCollection.deleteOne(query);
            res.send(result);
        })

        app.get('/myOrders/:id', async (req, res) => {
            const id = req.params.id;
            const query = {
                _id: ObjectId(id)
            };
            const order = await ordersCollection.findOne(query);
            res.send(order);
        })

        app.get('/reviews', async (req, res) => {
            const query = {};
            const reviews = await reviewsCollection.find(query).toArray()
            res.send(reviews)
        })

        app.post('/reviews', async (req, res) => {
            const addedReview = req.body;
            const result = await reviewsCollection.insertOne(addedReview)
            res.send(result)
        })
    } finally {}
}

run().catch(console.dir)

app.get('/', (req, res) => {
    res.send('Jantrick')
})

app.listen(port, () => {
    console.log(`Server is running at ${port}`);
})