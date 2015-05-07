var _http = require('http');
var _https = require('https');
var _os = require('os');
var _param = require('./param.json');
var _request = require('request');

// remember the previous poll data so we can provide proper counts
var _previous = {};

// if we have a name and password, then add an auth header
var _httpOptions = {};
if (_param.username)
    _httpOptions = { auth: { user: _param.username, pass: _param.password, sendImmediately: true }};

// if we should ignore self signed certificates
if ('strictSSL' in _param && _param.strictSSL === false)
    _httpOptions.strictSSL = false;

// if we do not have a source, then set it
_param.source = _param.source || _os.hostname();

// accumulate a value and return the difference from the previous value
function accumulate(key, newValue)
{
    var oldValue;
    if (key in _previous)
        oldValue = _previous[key];
    else
        oldValue = newValue;

    var difference = diff(newValue, oldValue);
    _previous[key] = newValue;
    return difference;
}

// get the natural difference between a and b
function diff(a, b)
{
    if (a == null || b == null)
        return 0;
    else
        return Math.max(a - b, 0);
}

// validate the input, return 0 if its not an integer
function parse(x)
{
    if (x == null) return 0;

    var y = parseInt(x, 10);
    return (isNaN(y) ? 0 : y);
}

function parseStatsJson(body)
{
    // See http://nginx.org/en/docs/http/ngx_http_status_module.html for body format

    var data;
    try
    {
        data = JSON.parse(body);
    }
    catch(e)
    {
        data = null;
    }

    return data;
}

function parseStatsText(body)
{
    /*
    See http://nginx.org/en/docs/http/ngx_http_stub_status_module.html for body format.
    Sample response:

    Active connections: 1
    server accepts handled requests
     112 112 121
    Reading: 0 Writing: 1 Waiting: 0
     */
    var stats = {};
    body.split('\n').forEach(function(line)
    {
        if (line.indexOf('Active connections:') === 0)
        {
            var active = line.match(/(\w+):\s*(\d+)/);
            stats[active[1].toLowerCase()] = parse(active[2]);
        }
        else if (line.match(/\s*(\d+)\s+(\d+)\s+(\d+)\s*$/))
        {
            var match = line.match(/\s*(\d+)\s+(\d+)\s+(\d+)\s*$/);
            stats.accepts = parse(match[1]);
            stats.handled = parse(match[2]);
            stats.requests = parse(match[3]);
            stats.nothandled = stats.accepts - stats.handled;
        }
        else if (line.match(/(\w+):\s*(\d+)/))
        {
            while(true)
            {
                var kvp = line.match(/(\w+):\s*(\d+)/);
                if (!kvp)
                    break;

                stats[kvp[1].toLowerCase()] = parse(kvp[2]);
                line = line.replace(kvp[0], '');
            }
        }
    });
    return stats;
}

function outputStats(stats, cb)
{
    var handled = ('handled' in _previous) ? diff(stats.handled, _previous.handled) : 0;
    var requests = ('requests' in _previous) ? diff(stats.requests, _previous.requests) : 0;
    var requestsPerConnection = (requests > 0 && handled !== 0) ? requests / handled : 0;

    // save the stats so we can calculate differences
    _previous = stats;

    jsonObject = JSON.stringify({
	"metrics" : [ {
	    "type" : "IntAverage",
	    "name" : "nginx|"+_param.source+"|Connections:Active",
	    "value": stats.connections
	    },
	    {
	    "type" : "IntAverage",
	    "name" : "nginx|"+_param.source+"|Connections:Idle",
	    "value": stats.waiting
	    },
	    {
	    "type" : "IntAverage",
	    "name" : "nginx|"+_param.source+"|Connections:Reading Request",
	    "value": stats.reading
	    },
	    {
	    "type" : "IntAverage",
	    "name" : "nginx|"+_param.source+"|Connections:Writing Response",
	    "value": stats.writing
	    },
	    {
	    "type" : "IntAverage",
	    "name" : "nginx|"+_param.source+"|Connections:Handled Connections",
	    "value": handled
	    },
	    {
	    "type" : "IntAverage",
	    "name" : "nginx|"+_param.source+"|Connections:Dropped Connections",
	    "value": stats.nothandled
	    },
	    {
	    "type" : "IntAverage",
	    "name" : "nginx|"+_param.source+":Requests per Interval",
	    "value": requests
	    },
	    {
	    "type" : "IntAverage",
	    "name" : "nginx|"+_param.source+":Average Requests per Connection",
	    "value": requestsPerConnection
	    }
	 ]
    });

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

    console.info('Options prepared:');
    console.info(optionspost);
    console.info('Do the POST call');

    // do the POST call
    var reqPost = _http.request(optionspost, function(res) {
        console.log("statusCode: ", res.statusCode);

        res.on('data', function(d) {
            console.info('POST result:\n');
            process.stdout.write(d);
            console.info('\n\nPOST completed');
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
function getStats(cb)
{
    // call nginx to get the stats page
    _request.get(_param.url, _httpOptions, function(err, resp, body)
    {
        if (err)
            return cb(err);
        if (resp.statusCode === 401)
            return cb(new Error('Nginx returned with an error - recheck the username/password you provided'));
        if (resp.statusCode !== 200)
            return cb(new Error('Nginx returned with an error - recheck the URL you provided'));
        if (!body)
            return cb(new Error('Nginx statistics return empty'));

        var stats;

        if (resp.headers['content-type'] == 'application/json')
        {
            stats = parseStatsJson(body);
        }
        else
        {
            stats = parseStatsText(body);
        }

	return cb(null, stats);
    });
}

function finish(err)
{
    if (err)
        console.error(err);

    setTimeout(poll, _param.pollInterval);
}

// get the stats, format the output and send to stdout
function poll(cb)
{
    getStats(function(err, stats)
    {
        if (err)
            return finish(err);
        if (!stats)
            return finish('Could not parse Nginx analytics');

        outputStats(stats, finish);
    });
}

poll();
