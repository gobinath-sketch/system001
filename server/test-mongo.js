const mongoose = require('mongoose');
const uri = 'mongodb+srv://akshayabalu6:Akshaya8220mongo@cluster0.dum4m.mongodb.net/?appName=Cluster0';
mongoose.connect(uri).then(async () => {
    const db = mongoose.connection.db;
    console.log('Database Name:', db.databaseName);
    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    mongoose.disconnect();
}).catch(console.error);
