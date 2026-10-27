# Try the first-app starter locally

This runs the example application, not a cloud platform. You need Node.js 22
and Git. No account, payment details, registry, or credentials are required.

```sh
git clone https://github.com/RemiGirard/TOAD-infra.git
cd TOAD-infra
HOST=127.0.0.1 node examples/node-web/server.mjs
```

Open http://127.0.0.1:3000. The page calls `/api/info`; use **Check the API** to
make another request. `/api/health` returns `{"ok":true}`.

Edit `examples/node-web/public/index.html` or `public/style.css` and reload.
Change `server.mjs`, restart with Ctrl+C, and reload to try an API change.
There is no install step because the app uses Node's standard library.

To try its production container:

```sh
docker build --tag toad-starter:local examples/node-web
docker run --rm --name toad-starter --publish 127.0.0.1:3000:3000 toad-starter:local
```

The container runs as the unprivileged `node` user and has a health check.
Stop it with Ctrl+C. Neither path provisions cloud resources or joins a Swarm.

Next, use [First app](FIRST-APP.md) to create a separate application directory,
publish an immutable image, and deploy to your platform. To create the
platform first, read [Evaluation](EVALUATION.md) or [Production](DEPLOYMENT.md).
