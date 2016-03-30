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

var pg_string = 'postgres://trasz:trasz@localhost/trasz';

var bodyParser = require('body-parser');
var express = require('express');
var pg = require('pg');
var morgan = require('morgan');

var app = express();
app.use(morgan('combined'));

var jsonParser = bodyParser.json();

app.post('/bat/v1/merge-tree', jsonParser, function(req, res) {
    pg.connect(pg_string, function(err, client, done) {
	    var rootId;

	    if (err) {
		    console.log(err);
		    return;
	    }

	    var query = client.query('SELECT * FROM bat_merge_tree()');
	    query.on('row', function(row) {
		    rootId = row.id;
	    });
	    query.on('end', function() {
		    client.end();
		    return res.json({'id': rootId});
	    });
	    query.on('error', function(err) {
		    client.end();
		    console.log(err);
		    return res.send(err);
	    });
    });
});

/*
 * Proper API begins here.
 */
app.post('/bat/v1/add-entry', jsonParser, function(req, res) {
    var data = {hash: req.body.hash, l: '', r: '', meta: req.body.meta};

    pg.connect(pg_string, function(err, client, done) {
	    var insertedId;

	    if (err) {
		    console.log(err);
		    return;
	    }

	    console.log('adding digest: ' + data.hash + '; metadata: ' + data.meta);

	    var query = client.query('SELECT * FROM bat_add_entry($1)', ['\\x' + data.hash]);
	    query.on('row', function(row) {
		    insertedId = row.id;
	    });
	    query.on('end', function() {
		    client.end();
		    return res.json({'id': insertedId});
	    });
	    query.on('error', function(err) {
		    client.end();
		    console.log(err);
		    return res.send(err);
	    });
    });
});

app.get('/bat/v1/get-sth', function(req, res) {
    pg.connect(pg_string, function(err, client, done) {
	    var out= {};

	    if (err) {
		    console.log(err);
		    return;
	    }

	    var query = client.query('SELECT * FROM bat_get_sth()');
	    query.on('row', function(row) {
		    out['tree_size'] = row.tree_size;
		    out['timestamp'] = row.t;
		    out['root_hash'] = row.hash;
		    //out['tree_head_signature'] = row.tree_head_signature;
	    });
	    query.on('end', function() {
		    client.end();
		    var json = { 'tree_size': out['tree_size'], 'timestamp': out['timestamp'],
		        'root_hash': out['root_hash'], 'tree_head_signature': out['tree_head_signature'] };
		    return res.json(json);
	    });
	    query.on('error', function(err) {
		    client.end();
		    console.log(err);
		    return res.send(err);
	    });
    });
});

app.get('/bat/v1/get-sth-consistency', function(req, res) {
    var first = req.query.first;
    var second = req.query.second;

    pg.connect(pg_string, function(err, client, done) {
	    var out= {};

	    if (err) {
		    console.log(err);
		    return;
	    }

	    var query = client.query('SELECT * FROM bat_get_sth_consistency($1, $2)', [first, second]);
	    query.on('row', function(row) {
		    //out['consistency'] = row.id;
		    out['tree_size'] = row.tree_size;
		    out['timestamp'] = row.t;
		    //out['root_hash'] = row.root_hash;
		    //out['tree_head_signature'] = row.tree_head_signature;
	    });
	    query.on('end', function() {
		    client.end();
		    var json = { 'consistency': out['consistency'], 'tree_size': out['tree_size'],
		        'timestamp': out['timestamp'], 'root_hash': out['root_hash'],
			'tree_head_signature': out['tree_head_signature'] };
		    return res.json(json);
	    });
	    query.on('error', function(err) {
		    client.end();
		    console.log(err);
		    return res.send(err);
	    });
    });
});

app.get('/bat/v1/get-proof-by-hash', function(req, res) {
    var hash = req.query.hash;
    var tree_size = req.query.tree_size;

    pg.connect(pg_string, function(err, client, done) {
	    var out= {};

	    if (err) {
		    console.log(err);
		    return;
	    }

	    var query = client.query('SELECT * FROM bat_get_proof_by_hash($1, $2)', ['\\x' + hash, tree_size]);
	    query.on('row', function(row) {
		    out['leaf_index'] = row.id;
		    //out['audit_path'] = row.audit_path;
		    out['tree_size'] = row.tree_size;
		    out['timestamp'] = row.t;
		    //out['root_hash'] = row.root_hash;
		    //out['tree_head_signature'] = row.tree_head_signature;
	    });
	    query.on('end', function() {
		    client.end();
		    var json = { 'leaf_index': out['tree_size'], 'audit_path': out['audit_path'],
		        'tree_size': out['tree_size'], 'timestamp': out['timestamp'],
			'root_hash': out['root_hash'], 'tree_head_signature': out['tree_head_signature'] };
		    return res.json(json);
	    });
	    query.on('error', function(err) {
		    client.end();
		    console.log(err);
		    return res.send(err);
	    });
    });
});

app.get('/bat/v1/get-all-by-hash', function(req, res) {
    var hash = req.query.hash;
    var tree_size = req.query.tree_size;

    pg.connect(pg_string, function(err, client, done) {
	    var out= {};

	    if (err) {
		    console.log(err);
		    return;
	    }

	    var query = client.query('SELECT * FROM bat_get_all_by_hash($1, $2)', ['\\x' + hash, tree_size]);
	    query.on('row', function(row) {
		    out['leaf_index'] = row.id;
		    //out['audit_path'] = row.audit_path;
		    out['tree_size'] = row.tree_size;
		    out['timestamp'] = row.t;
		    //out['root_hash'] = row.root_hash;
		    //out['tree_head_signature'] = row.tree_head_signature;
		    //out['consistency'] = row.consistency;
	    });
	    query.on('end', function() {
		    client.end();
		    var json = { 'leaf_index': out['tree_size'], 'audit_path': out['audit_path'],
		        'tree_size': out['tree_size'], 'timestamp': out['timestamp'],
			'root_hash': out['root_hash'], 'tree_head_signature': out['tree_head_signature'],
			'consistency': out['consistency'] };
		    return res.json(json);
	    });
	    query.on('error', function(err) {
		    client.end();
		    console.log(err);
		    return res.send(err);
	    });
    });
});

app.get('/bat/v1/get-entries', function(req, res) {
    var start = req.query.start;
    var end = req.query.end;

    pg.connect(pg_string, function(err, client, done) {
	    var results = [];
	    var out = {};

	    if (err) {
		    console.log(err);
		    return;
	    }

	    var query = client.query('SELECT * FROM bat_get_entries($1, $2)', [start, end]);
	    query.on('row', function(row) {
		    results.push({'hash': row.hash.toString('hex'), 'extra_data': '', 'sct': '', 'timestamp': row.t });
	    });
	    query.on('end', function() {
		    client.end();

		    out['entries'] = results;
		    //out['tree_size'] = xxx;
		    //out['timestamp'] = xxx;
		    //out['root_hash'] = xxx;
		    //out['tree_head_signature'] = xxx;

		    return res.json(out);
	    });
	    query.on('error', function(err) {
		    client.end();
		    console.log(err);
		    return res.send(err);
	    });
    });
});

var server = app.listen(8888);
