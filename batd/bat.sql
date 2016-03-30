/*-
 * Copyright (c) 2015 The FreeBSD Foundation
 * All rights reserved.
 *
 * This software was developed by Edward Tomasz Napierala under sponsorship
 * from the FreeBSD Foundation.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR AND CONTRIBUTORS ``AS IS'' AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED.  IN NO EVENT SHALL THE AUTHOR OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
 * OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
 * OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
 * SUCH DAMAGE.
 *
 */

SET plpgsql.extra_warnings TO 'all';
SET plpgsql.extra_errors TO 'all';

/*
 * XXX: Remove it eventually.
 */
DELETE FROM bat;
DROP TABLE bat CASCADE;

/*
 * Note that PostgreSQL creates indexes on id and hash for us.
 */
CREATE TABLE IF NOT EXISTS bat (id SERIAL PRIMARY KEY, t TIMESTAMP DEFAULT now(), hash BYTEA NOT NULL UNIQUE, l INTEGER REFERENCES bat (id) NULL UNIQUE, r INTEGER REFERENCES bat (id) NULL UNIQUE, meta JSON, tree_size INTEGER NOT NULL);

/*
 * The sequence here is used as tree_size - ie for each node, the 'tree_size' for the tree below it is the id.
 */
ALTER SEQUENCE bat_id_seq RESTART WITH 1;

/*
 * Insert the first leaf node.
 */
INSERT INTO bat (hash, tree_size) (SELECT digest(E'\\x00' || '', 'sha256'), 1);

/*
 * Static functions - or what would be static functions if this language had them.
 */
DROP FUNCTION IF EXISTS bat_join(INTEGER, INTEGER);
CREATE FUNCTION bat_join(v_a INTEGER, v_b INTEGER) RETURNS INTEGER AS $$
DECLARE
        hash_a BYTEA;
        hash_b BYTEA;
	tree_size_a INTEGER;
	tree_size_b INTEGER;
	tree_size_new INTEGER;
        id INTEGER;
BEGIN
        SELECT hash INTO hash_a FROM bat WHERE bat.id = v_a;
        SELECT tree_size INTO tree_size_a FROM bat WHERE bat.id = v_a;
        SELECT hash INTO hash_b FROM bat WHERE bat.id = v_b;
        SELECT tree_size INTO tree_size_b FROM bat WHERE bat.id = v_b;
	tree_size_new := tree_size_a + tree_size_b + 1;
        INSERT INTO bat (hash, l, r, tree_size) (SELECT digest(E'\\x01' || hash_a || hash_b, 'sha256'), v_a, v_b, tree_size_new) RETURNING bat.id INTO id;
        RETURN id;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS bat_get_root_id();
CREATE FUNCTION bat_get_root_id() RETURNS INTEGER AS $$
DECLARE
	id_root INTEGER;
BEGIN
        SELECT id INTO id_root FROM bat ORDER BY tree_size DESC LIMIT 1;
	RETURN id_root;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS bat_get_sibling_id(INTEGER);
CREATE FUNCTION bat_get_sibling_id(v_id INTEGER) RETURNS INTEGER AS $$
DECLARE
	id_sibling INTEGER;
BEGIN
	SELECT id INTO id_sibling FROM bat WHERE id = (SELECT r FROM bat WHERE l = v_id) UNION ALL SELECT id FROM bat WHERE id = (SELECT l FROM bat WHERE r = v_id);

	RETURN id_sibling;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS bat_get_consistency(INTEGER);
CREATE FUNCTION bat_get_consistency(v_id INTEGER) RETURNS SETOF bat AS $$
DECLARE
	id_current INTEGER;
	id_sibling INTEGER;
BEGIN
	id_current := v_id;

	LOOP
		SELECT id INTO id_sibling FROM bat WHERE id = (SELECT r FROM bat WHERE l = id_current) UNION ALL
		    SELECT id FROM bat WHERE id = (SELECT l FROM bat WHERE r = id_current);
		IF NOT FOUND THEN
			EXIT;
		END IF;
		RAISE NOTICE 'sibling for % is %', id_current, id_sibling;

		RETURN QUERY SELECT * FROM bat WHERE id = (SELECT r FROM bat WHERE l = id_current) UNION ALL
		    SELECT * FROM bat WHERE id = (SELECT l FROM bat WHERE r = id_current);

		SELECT id INTO id_current FROM bat WHERE l = id_current OR r = id_current;
	END LOOP;
END;
$$ LANGUAGE plpgsql;

/*
 * API called by Node.js.
 */
DROP FUNCTION IF EXISTS bat_merge_tree();
CREATE FUNCTION bat_merge_tree() RETURNS INTEGER AS $$
DECLARE
        id_l INTEGER;
        id_r INTEGER;
	id_root INTEGER;
BEGIN
	LOOP
		/*
		 * Get two rows with smallest tree_size and no parent node...
		 */
		SELECT id INTO id_l FROM bat AS ch WHERE NOT EXISTS
		    (SELECT 1 FROM bat AS p WHERE p.l = ch.id) AND NOT EXISTS (SELECT 1 FROM bat AS p WHERE p.r = ch.id)
		    ORDER BY tree_size LIMIT 1;
		IF NOT FOUND THEN
			EXIT;
		END IF;
		-- RAISE NOTICE 'id_l = %', id_l;

		SELECT id INTO id_r FROM bat AS ch WHERE id != id_l AND NOT EXISTS
		    (SELECT 1 FROM bat AS p WHERE p.l = ch.id) AND NOT EXISTS (SELECT 1 FROM bat AS p WHERE p.r = ch.id)
		    ORDER BY tree_size LIMIT 1;
		IF NOT FOUND THEN
			EXIT;
		END IF;
		-- RAISE NOTICE 'id_r = %', id_r;

		/*
		 * ... and join them together.
		 */
		SELECT * INTO id_root FROM bat_join(id_l, id_r);
	END LOOP;
	RETURN id_root;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS bat_add_entry(BYTEA);
CREATE FUNCTION bat_add_entry(v_hash BYTEA) RETURNS INTEGER AS $$
DECLARE
        id INTEGER;
BEGIN
        INSERT INTO bat (hash, tree_size) VALUES (v_hash, 1) RETURNING bat.id INTO id;
        RETURN id;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS bat_get_sth();
CREATE FUNCTION bat_get_sth() RETURNS SETOF bat AS $$
DECLARE
	id_root INTEGER;
BEGIN
	SELECT * INTO id_root FROM bat_get_root_id();
        RETURN QUERY SELECT * FROM bat WHERE bat.id = id_root;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS bat_get_sth_consistency(INTEGER, INTEGER);
CREATE FUNCTION bat_get_sth_consistency(v_first INTEGER, v_second INTEGER) RETURNS SETOF bat AS $$
BEGIN
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS bat_get_proof_by_hash(BYTEA, INTEGER);
CREATE FUNCTION bat_get_proof_by_hash(v_hash BYTEA, v_tree_size INTEGER) RETURNS SETOF bat AS $$
BEGIN
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS bat_get_all_by_hash(BYTEA, INTEGER);
CREATE FUNCTION bat_get_all_by_hash(v_hash BYTEA, v_tree_size INTEGER) RETURNS SETOF bat AS $$
BEGIN
        RETURN QUERY SELECT * FROM bat WHERE bat.hash = v_hash;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS bat_get_entries(INTEGER, INTEGER);
CREATE FUNCTION bat_get_entries(v_start INTEGER, v_end INTEGER) RETURNS SETOF bat AS $$
BEGIN
        RETURN QUERY SELECT * FROM bat WHERE bat.id >= v_start AND bat.id <= v_end;
END;
$$ LANGUAGE plpgsql;

