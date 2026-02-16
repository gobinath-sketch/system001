const fs = require('fs');
const https = require('https');
const path = require('path');

const logos = [
    { name: 'ibm.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/5/51/IBM_logo.svg' },
    { name: 'redhat.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/e/e0/Red_Hat_text_logo.svg' },
    { name: 'microsoft.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/9/96/Microsoft_logo.svg' },
    { name: 'blockchain.svg', url: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Blockchain.svg' },
    { name: 'tableau.svg', url: 'https://www.vectorlogo.zone/logos/tableau/tableau-icon.svg' },
    { name: 'mulesoft.svg', url: 'https://www.vectorlogo.zone/logos/mulesoft/mulesoft-icon.svg' },
    { name: 'trending.svg', url: 'https://www.svgrepo.com/show/331304/trend-up.svg' },
    { name: 'ai_alliance.svg', url: 'https://www.svgrepo.com/show/306354/artificial-intelligence.svg' }
];

const download = (url, dest) => {
    const file = fs.createWriteStream(dest);
    const options = {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    };

    https.get(url, options, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            download(response.headers.location, dest);
            return;
        }
        if (response.statusCode !== 200) {
            console.error(`Failed to download ${url}: ${response.statusCode}`);
            file.close();
            fs.unlink(dest, () => { });
            return;
        }
        response.pipe(file);
        file.on('finish', () => {
            file.close();
            console.log(`Downloaded ${dest}`);
        });
    }).on('error', (err) => {
        fs.unlink(dest, () => { });
        console.error(`Error downloading ${url}: ${err.message}`);
    });
};

const dir = path.join(__dirname, 'client/src/assets/logos');
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

logos.forEach(logo => {
    download(logo.url, path.join(dir, logo.name));
});
