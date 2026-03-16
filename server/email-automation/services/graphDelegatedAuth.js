const GraphUserToken = require('../models/GraphUserToken');

const GRAPH_AUTH_BASE = 'https://login.microsoftonline.com';
const GRAPH_SCOPE = [
    'offline_access',
    'User.Read',
    'Chat.Read'
];

function requiredEnv(name) {
    const value = String(process.env[name] || '').trim();
    if (!value) throw new Error(`Missing required env: ${name}`);
    return value;
}

function getAuthConfig() {
    return {
        tenantId: requiredEnv('AZURE_TENANT_ID'),
        clientId: requiredEnv('AZURE_CLIENT_ID'),
        clientSecret: requiredEnv('AZURE_CLIENT_SECRET'),
        redirectUri: requiredEnv('GRAPH_REDIRECT_URI'),
        scope: GRAPH_SCOPE.join(' ')
    };
}

function buildAuthUrl(state) {
    const { tenantId, clientId, redirectUri, scope } = getAuthConfig();
    const url = new URL(`${GRAPH_AUTH_BASE}/${tenantId}/oauth2/v2.0/authorize`);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_mode', 'query');
    url.searchParams.set('scope', scope);
    url.searchParams.set('state', state);
    return url.toString();
}

async function exchangeCodeForToken(code) {
    const { tenantId, clientId, clientSecret, redirectUri, scope } = getAuthConfig();
    const tokenUrl = `${GRAPH_AUTH_BASE}/${tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
        client_id: clientId,
        scope,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        client_secret: clientSecret
    });

    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
    });

    const payload = await response.json();
    if (!response.ok) {
        const err = new Error('Failed to exchange auth code');
        err.payload = payload;
        throw err;
    }

    return payload;
}

async function refreshAccessToken(refreshToken) {
    const { tenantId, clientId, clientSecret, scope } = getAuthConfig();
    const tokenUrl = `${GRAPH_AUTH_BASE}/${tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
        client_id: clientId,
        scope,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        client_secret: clientSecret
    });

    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
    });

    const payload = await response.json();
    if (!response.ok) {
        const err = new Error('Failed to refresh access token');
        err.payload = payload;
        throw err;
    }

    return payload;
}

async function upsertUserToken(userId, tokenPayload) {
    const expiresIn = Number(tokenPayload.expires_in || 3600);
    const expiresAt = new Date(Date.now() + (expiresIn - 60) * 1000);
    const scopes = String(tokenPayload.scope || '').split(' ').filter(Boolean);

    const update = {
        accessToken: tokenPayload.access_token,
        refreshToken: tokenPayload.refresh_token,
        expiresAt,
        scopes
    };

    await GraphUserToken.findOneAndUpdate(
        { user: userId },
        update,
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
}

async function getValidAccessToken(userId) {
    const tokenDoc = await GraphUserToken.findOne({ user: userId });
    if (!tokenDoc) {
        const err = new Error('User has not connected Teams Chats');
        err.code = 'NOT_CONNECTED';
        throw err;
    }

    if (tokenDoc.expiresAt && tokenDoc.expiresAt.getTime() > Date.now()) {
        return tokenDoc.accessToken;
    }

    const refreshed = await refreshAccessToken(tokenDoc.refreshToken);
    await upsertUserToken(userId, refreshed);
    return refreshed.access_token;
}

module.exports = {
    buildAuthUrl,
    exchangeCodeForToken,
    upsertUserToken,
    getValidAccessToken
};
