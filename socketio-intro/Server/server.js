const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const admin = require('firebase-admin');
const serviceAccount = require('../firebase-service-admin.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://<chatapp-92f6f>.firebaseio.com",
    storageBucket: "<chatapp-92f6f>.appspot.com"
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// User Registration
app.post('/signup', express.json(), async (req, res) => {
    const { email, password, name } = req.body;
    try {
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: name
        });

        await db.collection('users').doc(userRecord.uid).set({
            email,
            name,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(201).send({ message: 'User created successfully', userId: userRecord.uid });
    } catch (error) {
        res.status(400).send({ error: error.message });
    }
});

// Fetch Users
app.get('/users', async (req, res) => {
    try {
        const snapshot = await db.collection('users').get();
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.send(users);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// Chat Management
io.on('connection', (socket) => {
    console.log('A user connected');

    // Join room
    socket.on('join room', (room) => {
        socket.join(room);
        io.to(room).emit('system message', `A user has joined the room: ${room}`);
    });

    // Leave room
    socket.on('leave room', (room) => {
        socket.leave(room);
        io.to(room).emit('system message', `A user has left the room: ${room}`);
    });

    // Chat messages
    socket.on('chat message', async ({ room, message }) => {
        const chatMessage = {
            sender: socket.id,
            text: message,
            createdAt: new Date().toISOString(),
        };

        await db.collection('rooms').doc(room).collection('messages').add(chatMessage);
        io.to(room).emit('chat message', chatMessage);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
