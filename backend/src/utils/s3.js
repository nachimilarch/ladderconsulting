const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const uploadToS3 = async (buffer, key, mimeType) => {
    await s3.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
    }));
    return key;
};

const getPresignedUrl = async (key, expiresIn = 3600) => {
    return getSignedUrl(s3, new GetObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
    }), { expiresIn });
};

module.exports = { s3, uploadToS3, getPresignedUrl };