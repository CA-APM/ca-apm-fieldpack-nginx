/* 
This node.js project collects performance metrics from an nginx stats URL.
This project collects simple metrics on a regular interval and submits
to CA APM's EPAgent via the RESTful interface.

 --with-http_stub_status_module flag is required in the nginx -V output

Ensure the status URL is enabled.  In your active nginx config file, 
ensure a status URL location is enabled under your server block.  

e.g.: 
server {
#add to existing server block

location /nginx_status {
    # activate stub_status module
    stub_status on;
 
    # do not log status polling
    access_log off;
 
    # restrict access to local only
    allow 127.0.0.1;
    deny all;
   }
} 


The metrics will be default be reported under 'nginx|<hostname>|...'.  As
multiple hosts can report to a single EPAgent's RESTful interface.  The inclusion
the <hostname> in the metric path gives a opportunity to disambiguate those
usages.

Usage: node index
The program will run in a loop polling the nginx status URL on the interval
defined in the param.json file.  Those metrics will be sent to the epagent
also specified in that file.
 */

var lastTopology = 0;
 
var _http = require('http');
var _https = require('https');
var _os = require('os');
var _param = require('./param.json');
var _request = require('request');
var dns = require('dns');


var Util = require('util');
var Tls = require('tls');

// remember the previous poll data so we can provide proper counts
var _previous = {};

// if we have a name and password, then add an auth header
var _httpOptions = {};
if (_param.username) {
	_httpOptions = {
		auth : {
			user : _param.username,
			pass : _param.password,
			sendImmediately : true
		}
	};
}

// if we should ignore self signed certificates
if ('strictSSL' in _param && _param.strictSSL === false) {
	_httpOptions.strictSSL = false;
}

// if we do not have a source, then set it
_param.source = _param.source || _os.hostname();

// get the natural difference between a and b
function diff(a, b) {
	if (a === null || b === null) {
		return 0;
	} else {
		return Math.max(a - b, 0);
	}
}

// accumulate a value and return the difference from the previous value
function accumulate(key, newValue) {
	var oldValue;
	if (key in _previous) {
		oldValue = _previous[key];
	} else {
		oldValue = newValue;
	}

	var difference = diff(newValue, oldValue);
	_previous[key] = newValue;
	return difference;
}

// validate the input, return 0 if its not an integer
function parse(x) {
	if (x === null) {
		return 0;
	}

	var y = parseInt(x, 10);
	return (isNaN(y) ? 0 : y);
}

function metricfy(x) {
	var result = x;
	result = result.replace(new RegExp(/[|:]/g), '_'); // , 'g'), '_');
	// result = result.replace(new RegExp('\|', 'g'), '_');
	return result;
}

function parseStatsJson(body) {
	// See http://nginx.org/en/docs/http/ngx_http_status_module.html for body
	// format

	var data;
	try {
		data = JSON.parse(body);
	} catch (e) {
		data = null;
	}

	return data;
}

function parseStatsText(body) {
	/*
	 * See http://nginx.org/en/docs/http/ngx_http_stub_status_module.html for
	 * body format. Sample response:
	 * 
	 * Active connections: 1 server accepts handled requests 112 112 121
	 * Reading: 0 Writing: 1 Waiting: 0
	 */
	var stats = {};
	body.split('\n').forEach(function(line) {
		if (line.indexOf('Active connections:') === 0) {
			var active = line.match(/(\w+):\s*(\d+)/);
			stats[active[1].toLowerCase()] = parse(active[2]);
		} else if (line.match(/\s*(\d+)\s+(\d+)\s+(\d+)\s*$/)) {
			var match = line.match(/\s*(\d+)\s+(\d+)\s+(\d+)\s*$/);
			stats.accepts = parse(match[1]);
			stats.handled = parse(match[2]);
			stats.requests = parse(match[3]);
			stats.nothandled = stats.accepts - stats.handled;
		} else if (line.match(/(\w+):\s*(\d+)/)) {
			while (true) {
				var kvp = line.match(/(\w+):\s*(\d+)/);
				if (!kvp) {
					break;
				}

				stats[kvp[1].toLowerCase()] = parse(kvp[2]);
				line = line.replace(kvp[0], '');
			}
		}
	});
	return stats;
}

function isArray(a) {
	return (!!a) && (a.constructor === Array);
}

function isObject(a) {
	return (!!a) && (a.constructor === Object);
}

function isNumber(n) {
	  return !isNaN(parseFloat(n)) && isFinite(n);
	}

function deeptest(obj, s){
	
	s= s.split('.');
	while (obj && s.length)
	{
		var name = s.shift();
	
	    if (!obj || !obj.hasOwnProperty(name)) {
	    	return false;
	    }
	    obj = obj[name];
	}  
	return true;
}



function outputStats(stats, cb) {
	var plus = false;

	if (!isArray(stats.handled) && !isArray(stats.requests)
			&& !isObject(stats.handled) && isObject(stats.requests)) {
		// processing nginxplus
		plus = true;
	}

	var handled = null;
	var requests = null;
	
	var previousvalid = false;
	
	var requestsPerConnection = null;
	if (!plus) {
		handled = ('handled' in _previous) ? diff(stats.handled,
				_previous.handled) : 0;
		requests = ('requests' in _previous) ? diff(stats.requests,
				_previous.requests) : 0;
		requestsPerConnection = (requests > 0 && handled !== 0) ? requests
				/ handled : 0;
	} else {
		
		previousvalid = deeptest(_previous, 'requests.total');
				
		handled = (deeptest(_previous, 'connections.accepted') && isNumber(_previous.connections.accepted)) ? diff(stats.connections.accepted,
				_previous.connections.accepted) : 0;
		requests = (deeptest(_previous, 'requests.total') && isNumber(_previous.requests.total)) ? diff(stats.requests.total,
				_previous.requests.total) : 0;
		requestsPerConnection = (requests > 0 && handled !== 0) ? requests
				/ handled : 0;
	}
	
	requestsPerConnection = Math.round(requestsPerConnection);

	var jsonObject1;
	var jsonObject;

	if (!plus) {
		jsonObject = JSON
				.stringify({
					"metrics" : [
							{
								"type" : "IntAverage",
								"name" : "nginx|" + _param.source
										+ "|Connections:Active",
								"value" : stats.connections
							},
							{
								"type" : "IntAverage",
								"name" : "nginx|" + _param.source
										+ "|Connections:Idle",
								"value" : stats.waiting
							},
							{
								"type" : "IntAverage",
								"name" : "nginx|" + _param.source
										+ "|Connections:Reading Request",
								"value" : stats.reading
							},
							{
								"type" : "IntAverage",
								"name" : "nginx|" + _param.source
										+ "|Connections:Writing Response",
								"value" : stats.writing
							},
							{
								"type" : "IntAverage",
								"name" : "nginx|" + _param.source
										+ "|Connections:Handled Connections",
								"value" : handled
							},
							{
								"type" : "IntAverage",
								"name" : "nginx|" + _param.source
										+ "|Connections:Dropped Connections",
								"value" : stats.nothandled
							},
							{
								"type" : "IntAverage",
								"name" : "nginx|" + _param.source
										+ ":Requests per Interval",
								"value" : requests
							},
							{
								"type" : "IntAverage",
								"name" : "nginx|" + _param.source
										+ ":Average Requests per Connection",
								"value" : requestsPerConnection
							} ]
				});
	} else {
		var sslhandshake = (previousvalid) ? diff(
				stats.ssl.handshakes, _previous.ssl.handshakes) : 0;
		var sslhandshakefail = (previousvalid) ? diff(
				stats.ssl.handshakes_failed, _previous.ssl.handshakes_failed)
				: 0;
		var sslsessionreuse = (previousvalid) ? diff(
				stats.ssl.session_reuses, _previous.ssl.session_reuses) : 0;

		jsonObject1 = [
				{
					"type" : "IntAverage",
					"name" : "nginx|" + _param.source + "|Connections:Active",
					"value" : stats.connections.active
				},
				{
					"type" : "IntAverage",
					"name" : "nginx|" + _param.source + "|Connections:Idle",
					"value" : stats.connections.idle
				},
				{
					"type" : "IntAverage",
					"name" : "nginx|" + _param.source
							+ "|Connections:Handled Connections",
					"value" : handled
				},
				{
					"type" : "IntAverage",
					"name" : "nginx|" + _param.source
							+ "|Connections:Dropped Connections",
					"value" : stats.connections.dropped
				},
				{
					"type" : "IntAverage",
					"name" : "nginx|" + _param.source
							+ ":Requests per Interval",
					"value" : requests
				},
				{
					"type" : "IntAverage",
					"name" : "nginx|" + _param.source
							+ ":Average Requests per Connection",
					"value" : requestsPerConnection
				},
				{
					"type" : "IntAverage",
					"name" : "nginx|" + _param.source
							+ "|SSL:Handshakes per Interval",
					"value" : sslhandshake
				},
				{
					"type" : "IntAverage",
					"name" : "nginx|" + _param.source
							+ "|SSL:Handshakes Failed per Interval",
					"value" : sslhandshakefail
				},
				{
					"type" : "IntAverage",
					"name" : "nginx|" + _param.source
							+ "|SSL:Session Reuses per Interval",
					"value" : sslsessionreuse
				} ];

		Object.keys(stats.server_zones).forEach(
				function(key) {
					// console.log(stats.server_zones[key]['requests']);
					var zrequests = (previousvalid) ? diff(
							stats.server_zones[key].requests,
							_previous.server_zones[key].requests) : 0;
					var zdiscarded = (previousvalid) ? diff(
							stats.server_zones[key].discarded,
							_previous.server_zones[key].discarded) : 0;
					var zprocessing = (previousvalid) ? diff(
							stats.server_zones[key].processing,
							_previous.server_zones[key].processing) : 0;
					var zresponses = (previousvalid) ? diff(
							stats.server_zones[key].responses.total,
							_previous.server_zones[key].responses.total) : 0;
					var zresponses1xx = (previousvalid) ? diff(
							stats.server_zones[key].responses['1xx'],
							_previous.server_zones[key].responses['1xx']) : 0;
					var zresponses2xx = (previousvalid) ? diff(
							stats.server_zones[key].responses['2xx'],
							_previous.server_zones[key].responses['2xx']) : 0;
					var zresponses3xx = (previousvalid) ? diff(
							stats.server_zones[key].responses['3xx'],
							_previous.server_zones[key].responses['3xx']) : 0;
					var zresponses4xx = (previousvalid) ? diff(
							stats.server_zones[key].responses['4xx'],
							_previous.server_zones[key].responses['4xx']) : 0;
					var zresponses5xx = (previousvalid) ? diff(
							stats.server_zones[key].responses['5xx'],
							_previous.server_zones[key].responses['5xx']) : 0;
					var zsent = (previousvalid) ? diff(
							stats.server_zones[key].sent,
							_previous.server_zones[key].sent) : 0;
					var zrcvd = (previousvalid) ? diff(
							stats.server_zones[key].received,
							_previous.server_zones[key].received) : 0;

					var jsonObject2 = [
							{
								"type" : "IntAverage",
								"name" : "nginx|" + _param.source
										+ "|Server Zone|" + metricfy(key)
										+ ":Requests per Interval",
								"value" : zrequests
							},
							{
								"type" : "IntAverage",
								"name" : "nginx|" + _param.source
										+ "|Server Zone|" + metricfy(key)
										+ ":Responses per Interval",
								"value" : zresponses
							},
							{
								"type" : "IntAverage",
								"name" : "nginx|" + _param.source
										+ "|Server Zone|" + metricfy(key)
										+ ":Discarded per Interval",
								"value" : zdiscarded
							},
							{
								"type" : "IntAverage",
								"name" : "nginx|" + _param.source
										+ "|Server Zone|" + metricfy(key)
										+ ":Processing per Interval",
								"value" : zprocessing
							},
							{
								"type" : "IntAverage",
								"name" : "nginx|" + _param.source
										+ "|Server Zone|" + metricfy(key)
										+ ":Sent Bytes per Interval",
								"value" : zsent
							},
							{
								"type" : "IntAverage",
								"name" : "nginx|" + _param.source
										+ "|Server Zone|" + metricfy(key)
										+ ":Received Bytes per Interval",
								"value" : zrcvd
							},
							{
								"type" : "IntAverage",
								"name" : "nginx|" + _param.source
										+ "|Server Zone|" + metricfy(key)
										+ "|Responses:1xx per Interval",
								"value" : zresponses1xx
							},
							{
								"type" : "IntAverage",
								"name" : "nginx|" + _param.source
										+ "|Server Zone|" + metricfy(key)
										+ "|Responses:2xx per Interval",
								"value" : zresponses2xx
							},
							{
								"type" : "IntAverage",
								"name" : "nginx|" + _param.source
										+ "|Server Zone|" + metricfy(key)
										+ "|Responses:3xx per Interval",
								"value" : zresponses3xx
							},
							{
								"type" : "IntAverage",
								"name" : "nginx|" + _param.source
										+ "|Server Zone|" + metricfy(key)
										+ "|Responses:4xx per Interval",
								"value" : zresponses4xx
							},
							{
								"type" : "IntAverage",
								"name" : "nginx|" + _param.source
										+ "|Server Zone|" + metricfy(key)
										+ "|Responses:5xx per Interval",
								"value" : zresponses5xx
							} ];

					jsonObject1 = jsonObject1.concat(jsonObject2);

				}); // end of forEach

		Object
				.keys(stats.upstreams)
				.forEach(
						function(key) {
							for (var k = 0; k < stats.upstreams[key].peers.length; k++) {
								var zrequests = (previousvalid) ? diff(
										stats.upstreams[key].peers[k].requests,
										_previous.upstreams[key].peers[k].requests)
										: 0;
								var zsent = (previousvalid) ? diff(
										stats.upstreams[key].peers[k].sent,
										_previous.upstreams[key].peers[k].sent)
										: 0;
								var zrcvd = (previousvalid) ? diff(
										stats.upstreams[key].peers[k].received,
										_previous.upstreams[key].peers[k].received)
										: 0;
								var zresponses1xx = (previousvalid) ? diff(
										stats.upstreams[key].peers[k].responses['1xx'],
										_previous.upstreams[key].peers[k].responses['1xx'])
										: 0;
								var zresponses2xx = (previousvalid) ? diff(
										stats.upstreams[key].peers[k].responses['2xx'],
										_previous.upstreams[key].peers[k].responses['2xx'])
										: 0;
								var zresponses3xx = (previousvalid) ? diff(
										stats.upstreams[key].peers[k].responses['3xx'],
										_previous.upstreams[key].peers[k].responses['3xx'])
										: 0;
								var zresponses4xx = (previousvalid) ? diff(
										stats.upstreams[key].peers[k].responses['4xx'],
										_previous.upstreams[key].peers[k].responses['4xx'])
										: 0;
								var zresponses5xx = (previousvalid) ? diff(
										stats.upstreams[key].peers[k].responses['5xx'],
										_previous.upstreams[key].peers[k].responses['5xx'])
										: 0;
								var fails = (previousvalid) ? diff(
										stats.upstreams[key].peers[k].fails,
										_previous.upstreams[key].peers[k].fails)
										: 0;
								var unavail = (previousvalid) ? diff(
										stats.upstreams[key].peers[k].unavail,
										_previous.upstreams[key].peers[k].unavail)
										: 0;
								var hcchecks = (previousvalid) ? diff(
										stats.upstreams[key].peers[k].health_checks.checks,
										_previous.upstreams[key].peers[k].health_checks.checks)
										: 0;
								var hcfails = (previousvalid) ? diff(
										stats.upstreams[key].peers[k].health_checks.fails,
										_previous.upstreams[key].peers[k].health_checks.fails)
										: 0;
								var hcunhealthy = (previousvalid) ? diff(
										stats.upstreams[key].peers[k].health_checks.unhealthy,
										_previous.upstreams[key].peers[k].health_checks.unhealthy)
										: 0;

								var jsonObject2 = [
										{
											"type" : "StringEvent",
											"name" : "nginx|"
													+ _param.source
													+ "|Upstreams|"
													+ metricfy(key)
													+ "|"
													+ metricfy(stats.upstreams[key].peers[k].server)
													+ ":Backup",
											"value" : stats.upstreams[key].peers[k].backup
										},
										{
											"type" : "StringEvent",
											"name" : "nginx|"
													+ _param.source
													+ "|Upstreams|"
													+ metricfy(key)
													+ "|"
													+ metricfy(stats.upstreams[key].peers[k].server)
													+ ":State",
											"value" : stats.upstreams[key].peers[k].state
										},
										{
											"type" : "IntAverage",
											"name" : "nginx|"
													+ _param.source
													+ "|Upstreams|"
													+ metricfy(key)
													+ "|"
													+ metricfy(stats.upstreams[key].peers[k].server)
													+ ":Requests per Interval",
											"value" : zrequests
										},
										{
											"type" : "IntAverage",
											"name" : "nginx|"
													+ _param.source
													+ "|Upstreams|"
													+ metricfy(key)
													+ "|"
													+ metricfy(stats.upstreams[key].peers[k].server)
													+ ":Weight",
											"value" : stats.upstreams[key].peers[k].weight
										},
										{
											"type" : "IntAverage",
											"name" : "nginx|"
													+ _param.source
													+ "|Upstreams|"
													+ metricfy(key)
													+ "|"
													+ metricfy(stats.upstreams[key].peers[k].server)
													+ ":Active Connections",
											"value" : stats.upstreams[key].peers[k].active
										},
										{
											"type" : "IntAverage",
											"name" : "nginx|"
													+ _param.source
													+ "|Upstreams|"
													+ metricfy(key)
													+ "|"
													+ metricfy(stats.upstreams[key].peers[k].server)
													+ ":Sent Bytes per Interval",
											"value" : zsent
										},
										{
											"type" : "IntAverage",
											"name" : "nginx|"
													+ _param.source
													+ "|Upstreams|"
													+ metricfy(key)
													+ "|"
													+ metricfy(stats.upstreams[key].peers[k].server)
													+ ":Received Bytes per Interval",
											"value" : zrcvd
										},
										{
											"type" : "IntAverage",
											"name" : "nginx|"
													+ _param.source
													+ "|Upstreams|"
													+ metricfy(key)
													+ "|"
													+ metricfy(stats.upstreams[key].peers[k].server)
													+ ":Failures per Interval",
											"value" : fails
										},
										{
											"type" : "IntAverage",
											"name" : "nginx|"
													+ _param.source
													+ "|Upstreams|"
													+ metricfy(key)
													+ "|"
													+ metricfy(stats.upstreams[key].peers[k].server)
													+ ":Unavailables per Interval",
											"value" : unavail
										},
										{
											"type" : "IntAverage",
											"name" : "nginx|"
													+ _param.source
													+ "|Upstreams|"
													+ metricfy(key)
													+ "|"
													+ metricfy(stats.upstreams[key].peers[k].server)
													+ "|Health Checks:Checks per Interval",
											"value" : hcchecks
										},
										{
											"type" : "IntAverage",
											"name" : "nginx|"
													+ _param.source
													+ "|Upstreams|"
													+ metricfy(key)
													+ "|"
													+ metricfy(stats.upstreams[key].peers[k].server)
													+ "|Health Checks:Failures per Interval",
											"value" : hcfails
										},
										{
											"type" : "IntAverage",
											"name" : "nginx|"
													+ _param.source
													+ "|Upstreams|"
													+ metricfy(key)
													+ "|"
													+ metricfy(stats.upstreams[key].peers[k].server)
													+ "|Health Checks:Unhealthy per Interval",
											"value" : hcunhealthy
										},
										{
											"type" : "IntAverage",
											"name" : "nginx|"
													+ _param.source
													+ "|Upstreams|"
													+ metricfy(key)
													+ "|"
													+ metricfy(stats.upstreams[key].peers[k].server)
													+ "|Responses:1xx per Interval",
											"value" : zresponses1xx
										},
										{
											"type" : "IntAverage",
											"name" : "nginx|"
													+ _param.source
													+ "|Upstreams|"
													+ metricfy(key)
													+ "|"
													+ metricfy(stats.upstreams[key].peers[k].server)
													+ "|Responses:2xx per Interval",
											"value" : zresponses2xx
										},
										{
											"type" : "IntAverage",
											"name" : "nginx|"
													+ _param.source
													+ "|Upstreams|"
													+ metricfy(key)
													+ "|"
													+ metricfy(stats.upstreams[key].peers[k].server)
													+ "|Responses:3xx per Interval",
											"value" : zresponses3xx
										},
										{
											"type" : "IntAverage",
											"name" : "nginx|"
													+ _param.source
													+ "|Upstreams|"
													+ metricfy(key)
													+ "|"
													+ metricfy(stats.upstreams[key].peers[k].server)
													+ "|Responses:4xx per Interval",
											"value" : zresponses4xx
										},
										{
											"type" : "IntAverage",
											"name" : "nginx|"
													+ _param.source
													+ "|Upstreams|"
													+ metricfy(key)
													+ "|"
													+ metricfy(stats.upstreams[key].peers[k].server)
													+ "|Responses:5xx per Interval",
											"value" : zresponses5xx
										} ];

								jsonObject1 = jsonObject1.concat(jsonObject2);
								// console.log(jsonObject1);
							}
						});

		var jsonObject2 = {
			"metrics" : jsonObject1
		};
		// console.log(jsonObject2);

		jsonObject = JSON.stringify(jsonObject2);

	}

	// save the stats so we can calculate differences
	_previous = stats;

	// prepare the header
	var postheaders = {
		'Content-Type' : 'application/json',
		'Content-Length' : Buffer.byteLength(jsonObject, 'utf8')
	};

	// the post options
	var optionspost = {
		host : _param.epahost,
		port : _param.epaport,
		path : '/apm/metricFeed',
		method : 'POST',
		headers : postheaders
	};

	/*
	console.info('Options prepared:');
	console.info(optionspost);
	console.info('Do the POST call');
	*/

	// do the POST call
	var reqPost = _http.request(optionspost, function(res) {
		//console.log("statusCode: ", res.statusCode);

		res.on('data', function(d) {
			//console.log('POST result:\n');
			//process.stdout.write(d);
			//console.log('\n\nPOST completed');
		});
	});

	// write the json data
	reqPost.write(jsonObject);
	reqPost.end();
	reqPost.on('error', function(e) {
		console.error(e);
	});

	return cb();
}

// call nginx and parse the stats
function getStats(cb) {
	// call nginx to get the stats page
	_request
			.get(
					_param.url,
					_httpOptions,
					function(err, resp, body) {
						if (err) {
							return cb(err);
						}
						if (resp.statusCode === 401) {
							return cb(new Error(
									'Nginx returned with an error - recheck the username/password you provided'));
						}
						if (resp.statusCode !== 200) {
							return cb(new Error(
									'Nginx returned with an error - recheck the URL you provided'));
						}
						if (!body) {
							return cb(new Error('Nginx statistics return empty'));
						}

						var stats;

						if (resp.headers['content-type'] == 'application/json') {
							stats = parseStatsJson(body);
						} else {
							stats = parseStatsText(body);
						}

						return cb(null, stats);
					});
}

function finish(err) {
	if (err) {
		console.error(err);
	}

	setTimeout(poll, _param.pollInterval);
}

/*
 * Creates the NGINX node in the map
 */
function createATCTopology(err,nginxIp){
	var nginxHost = _param.source;
	
	var topologyObj =	{
		  "graph": {
			"vertices": [
			  {
				"id": "ATC:nginx:"+nginxHost,
				"layer" : "ATC",
				"attributes": {
				  "name": "NGINX-"+nginxHost,
				  "type" : "nginx",
				  "hostname": _param.source,
				  "ipAddress": nginxIp,
				  "agent":_param.agentname,
				  "TTPlugin.sourceID": "ca-apm-fieldpack-nginx",
				  "TTPlugin.correlation.proxy.1.source.host": nginxHost,
				  "TTPlugin.correlation.proxy.1.source.ip": nginxIp,
				  "TTPlugin.correlation.proxy.1.source.port": "80"
				}
			  }
			],
			"edges" : []
		  }
		};
	jsonObject = JSON.stringify(topologyObj);
	var postheaders = {
		'Content-Type' : 'application/json',
		'Authorization' : 'Bearer '+_param.atctoken,
		'Content-Length' : Buffer.byteLength(jsonObject, 'utf8')
	};

       var optionspost = getOptionspost('/apm/appmap/ats/graph/store',postheaders)

	/*
	console.info('Options prepared:');
	console.info(optionspost);
	console.info('Do the POST call');
	*/

        var reqPost = getRegPost(optionspost);

	// write the json data
	reqPost.write(jsonObject);
	reqPost.end();
	reqPost.on('error', function(e) {
		console.error(e);
	});
}


/*
 * Configs nginx node on the map
 */
function createATCConfig(){
	var atcConfig =	{
		  "id" : "nginx",
		  "version" : _param.configversion,
		  "metricSpecifiers" : {
			"nginx": [
			  {
				"metricSpecifier": {
				  "format": "nginx|<hostname>",
				  "type": "EXACT"
				},
				"agentSpecifier": {
				  "format": ".*|.*|.*",
				  "type": "REGEX"
				},
				"section": "nginx Metrics",
				"metricNames": [
				  "Average Requests per Connection"
				],
				"filter": {}
			  },
			  {
				"metricSpecifier": {
				  "format": "nginx|<hostname>",
				  "type": "EXACT"
				},
				"agentSpecifier": {
				  "format": ".*|.*|.*",
				  "type": "REGEX"
				},
				"section": "nginx Metrics",
				"metricNames": [
				  "Requests per Interval"
				],
				"filter": {}
			  },
			 {
				"metricSpecifier": {
				  "format": "nginx|<hostname>|Connections",
				  "type": "EXACT"
				},
				"agentSpecifier": {
				  "format": ".*|.*|.*",
				  "type": "REGEX"
				},
				"section": "nginx Metrics",
				"metricNames": [
				  "Active"
				],
				"filter": {}
			  },
			 {
				"metricSpecifier": {
				  "format": "nginx|<hostname>|Connections",
				  "type": "EXACT"
				},
				"agentSpecifier": {
				  "format": ".*|.*|.*",
				  "type": "REGEX"
				},
				"section": "nginx Metrics",
				"metricNames": [
				  "Idle"
				],
				"filter": {}
			  }   			  
			]
		  },
		  "metricRootSpecifiers":{
			  "nginx":[
                                 {
                                        "rootSpecifier":"<agent>|nginx|<hostname>",
                                        "nextLevelRegex":null
                                 }
			  ]
		   },
		  "alertMappings": {
			"nginx": [
			  "nginx|<hostname>"
			]
		  }
	};
		
	jsonObject = JSON.stringify(atcConfig);
	
	var postheaders = {
		'Content-Type' : 'application/json',
		'Authorization' : 'Bearer '+_param.atctoken,
		'Content-Length' : Buffer.byteLength(jsonObject, 'utf8')
	};

	var optionspost = getOptionspost('/apm/appmap/ats/extension/configure',postheaders)

	/*
	console.info('Options prepared:');
	console.info(optionspost);
	console.info('Do the POST call');
	*/

	var reqPost = getRegPost(optionspost);

	// write the json data
	reqPost.write(jsonObject);
	reqPost.end();
	reqPost.on('error', function(e) {
		console.error(e);
	});
}

function checkTopology(){
	var timeDiff = Date.now() - lastTopology;
	if ( timeDiff > Number(_param.refreshtopology) || lastTopology == 0 ){
		var err = null;
		var result = 0;
		var lk = dns.lookup(_param.source,createATCTopology);
		lastTopology = Date.now();
	}
}



function HttpsProxyAgent(options) {

    _https.Agent.call(this, options);

    this.proxyHost = options.proxyHost;
    this.proxyPort = options.proxyPort;

    this.createConnection = function (opts, callback) {
        var req = _http.request({
        host: options.proxyHost,
        port: options.proxyPort,
        method: 'CONNECT',
        path: opts.host + ':' + opts.port,
        headers: {
            host: opts.host
        }
    });

    req.on('connect', function (res, socket, head) {
    var cts = Tls.connect({
        host: opts.host,
        socket: socket
    }, function () {
        callback(false, cts);
    });
    });

    req.on('error', function (err) {
        callback(err, null);
    });

    req.end();
    }
}

Util.inherits(HttpsProxyAgent, _https.Agent);


HttpsProxyAgent.prototype.addRequest = function (req, options) {
var name = options.host + ':' + options.port;
if (options.path) name += ':' + options.path;

if (!this.sockets[name]) this.sockets[name] = [];

if (this.sockets[name].length < this.maxSockets) {
    this.createSocket(name, options.host, options.port, options.path, req, function (socket) {
        req.onSocket(socket);
    });
} else {
    if (!this.requests[name])
    this.requests[name] = [];
    this.requests[name].push(req);
}
};

HttpsProxyAgent.prototype.createSocket = function (name, host, port, localAddress, req, callback) {
    var self = this;
    var options = Util._extend({}, self.options);
    options.port = port;
    options.host = host;
    options.localAddress = localAddress;

    options.servername = host;
    if (req) {
        var hostHeader = req.getHeader('host');
        if (hostHeader)
            options.servername = hostHeader.replace(/:.*$/, '');
    }

    self.createConnection(options, function (err, s) {
    if (err) {
        err.message += ' while connecting to HTTP(S) proxy server ' + self.proxyHost + ':' + self.proxyPort;

        if (req)
            req.emit('error', err);
        else
            throw err;

    return;
}

if (!self.sockets[name]) self.sockets[name] = [];

self.sockets[name].push(s);

var onFree = function () {
    self.emit('free', s, host, port, localAddress);
};

var onClose = function (err) {
    self.removeSocket(s, name, host, port, localAddress);
};

var onRemove = function () {
    self.removeSocket(s, name, host, port, localAddress);
    s.removeListener('close', onClose);
    s.removeListener('free', onFree);
    s.removeListener('agentRemove', onRemove);
};

s.on('free', onFree);
s.on('close', onClose);
s.on('agentRemove', onRemove);

callback(s);
});
};


function getRegPost(optionspost){
        if (_param.atcconnection == "http"){
                var reqPost = _http.request(optionspost, function(res) {
                        console.log("-------------------------");
                        console.log("statusCode  : ", res.statusCode);
                        console.log("-------------------------");
                        res.on('data', function(d) {
                                console.info('POST result:\n');
                                process.stdout.write(d);
                                console.info('\n\nPOST completed - Config');
                        });
                });
        }else{
                var reqPost = _https.request(optionspost, function(res) {
                        console.log("-------------------------");
                        console.log("statusCode : ", res.statusCode);
                        console.log("-------------------------");
                        res.on('data', function(d) {
                                console.log('POST result:\n');
                                process.stdout.write(d);
                                console.log('\n\nPOST completed - Config');
                        });
                });
        }
	return reqPost;
}


function getOptionspost(atcUrl,postheaders) {

	var baseOptions = {
			host : _param.atchost,
			port : _param.atcport,
			path : atcUrl,
			headers: {
					Host: _param.atchost
			},
			method : 'POST',
			headers : postheaders,
			strictSSL: false,
			rejectUnauthorized: false,
	};
	
	if (_param.proxytype=="https"){
		var agent = new HttpsProxyAgent({
				proxyHost: _param.proxyhost,
				proxyPort: _param.proxyport
		});	
		baseOptions.agent = agent
	} else {
		if (_param.proxytype=="http"){
			baseOptions.path = _param.atcconnection+'://'+param.atchost+atcUrl
		} 
	}
	
	return baseOptions;
}


// get the stats, format the output and send to stdout
function poll(cb) {

        //shoul I create a new node ?
        checkTopology();

        getStats(function(err, stats) {
                if (err) {
                        return finish(err);
                }
                if (!stats) {
                        return finish('Could not parse Nginx analytics');
                }

                outputStats(stats, finish);
        });

}


/* MAIN PROCESS */

console.info("----------------------------------------------");
console.info("NGINX Monitor started...");
console.info("----------------------------------------------");


createATCConfig();

poll();
	


	

