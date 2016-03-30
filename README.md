The code here is what's left of a short-lived project sponsored by the FreeBSD
Foundation to implement Binary Artifact Transparency functionality using node.js
and PostgreSQL, instead of official Google's certificate-transparency code.
Postgres was used due to its storage and JSON search capabilities.  The idea was
to do as much as possible on the database side.

In practical terms, there's not much.  If you need a PL/pgSQL implementation
of Merkle tree, with tree merging implemented as stored procedures - it's
there, go grab it.  Feel free to mail me if you have any questions:

	Edward Tomasz Napierala <trasz@FreeBSD.org>

