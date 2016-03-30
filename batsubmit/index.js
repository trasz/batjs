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

var crypto = require('crypto');
var fs = require('fs');
var request = require('request');

if (process.argv.length != 4 && process.argv.length != 5) {
	console.error('usage: batsubmit hostname path [json]');
	process.exit(1);
}

var hash = crypto.createHash('sha256');
var s = fs.ReadStream(process.argv[3]);

s.on('error', function(err) {
	console.error(err);
	process.exit(1);
});
s.on('data', function(data) {
	hash.update(data);
});
s.on('end', function() {
	var digest = hash.digest('hex');

	console.log('digest: ' + digest);

	var url = 'http://' + process.argv[2] + ':8888/bat/v1/add-entry';
	var options = {
		uri: url,
		method: 'POST',
		json: {
			'hash': digest,
			'meta': process.argv[4]
		}
	};

	request(options, function (err, response, body) {
		if (err) {
			console.log(err);
		} else {
			console.log(body)
		}
	});
});
