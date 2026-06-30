const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// 'common' serves signing keys valid across ALL Microsoft tenants (work/school
// and personal accounts) — required since login isn't pinned to one tenant.
const client = jwksClient({
    jwksUri: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
    cache: true,
    cacheMaxAge: 24 * 60 * 60 * 1000,
});

const getSigningKey = (header, callback) => {
    client.getSigningKey(header.kid, (err, key) => {
        if (err) return callback(err);
        callback(null, key.getPublicKey());
    });
};

// Verifies signature, expiry, and audience. Issuer is checked manually after
// verification since it embeds the caller's actual tenant GUID and varies
// per-tenant — only the well-known prefix/suffix is fixed.
async function verifyMicrosoftIdToken(idToken) {
    const payload = await new Promise((resolve, reject) => {
        jwt.verify(
            idToken,
            getSigningKey,
            { audience: process.env.MICROSOFT_CLIENT_ID, algorithms: ['RS256'] },
            (err, decoded) => (err ? reject(err) : resolve(decoded))
        );
    });

    const issuerPattern = /^https:\/\/login\.microsoftonline\.com\/[^/]+\/v2\.0$/;
    if (!issuerPattern.test(payload.iss)) {
        throw new Error('Unrecognized token issuer.');
    }

    return {
        providerUserId: payload.oid || payload.sub,
        email: payload.email || payload.preferred_username,
        name: payload.name,
        tenantId: payload.tid,
    };
}

module.exports = { verifyMicrosoftIdToken };
