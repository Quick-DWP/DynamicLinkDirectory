import apiRoutes from "./api/index.js";

export default async function routes(fastify) {
    await fastify.register(apiRoutes, { prefix: '/api' });

    fastify.setNotFoundHandler(async (request, reply) => {
        const url = request.raw.url || '';
        if (url.startsWith('/api/')) {
            return reply.code(404).send({ ok: false, message: 'API route not found' });
        }
        return reply.type('text/html; charset=utf-8').sendFile('index.html');
    });
}
