# nginx Monitor

# Description
The nginx Monitor watches [nginx](http://nginx.org/en/ "nginx") web server status and reports metrics to the CA APM EPAgent REST interface.

# Short Description
The nginx Monitor watches and reports on [nginx](http://nginx.org/en/ "nginx") web servers.

# APM version
The nginx Monitor has been tested with CA APM 9.7.1.  

An EPAgent 9.7.1 or greater is required for the REST interface.

# Dependencies
Requires an EPAgent 9.7.1 or greater for the REST interface.

Requires nginx open source with stub status module or nginx plus with the status module enabled.

# Supported Third Party Versions
`nginx 1.6.3 --with-http_stub_status_module`

`node v0.10.38`

# License
[Eclipse Public License 1.0](https://www.eclipse.org/legal/epl-v10.html "Eclipse Public License")

# Prerequisites

## Open Source nginx

1. Ensure that nginx has the `--with-http_stub_status_module` flag by executing this command:

    `nginx -V`
	
   The flag should appear in the output.

2. Identify the active [nginx config file.](http://nginx.org/en/docs/beginners_guide.html#conf_structure)
* Use the `--conf-path` flag value from the output in Step 1.

3. Enable a status URL location under the server block.

   For example:
```
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
```
4. Test the URL.
   The output should look similar to this example:
```
    Active connections: 1
    server accepts handled requests
    112 112 121
    Reading: 0 Writing: 1 Waiting: 0
```

# Monitor NGINX Plus
Add NGINX Plus monitoring to the nginx Monitor capabilities.

1.Download the NGINX Plus [live activity monitoring](https://www.nginx.com/products/live-activity-monitoring/) status plug-in.
2. Test the status URL.

The JSON stream output should looks similar to the output shown on the [nginx demo site.](http://demo.nginx.com/status)

# Install and Configure the RESTful EPAgent

1. Install the CA APM EPAgent.
Find the CA APM EPAgent documentation on [the CA APM documentation wiki.](https://docops.ca.com)
2. Configure the EPAgent RESTful interface.
3. Set the HTTP port.
The host and port running the EPAgent should be reachable from the host that is running the nginx monitoring script.

# Installation

1. Copy the nginx Monitor index.js and param.json files to a convenient location.

2, From the same location, execute this command:

    `npm install request`

# Configuration
* Edit the param.json file to provide this information:

  - The status URL specified in the prerequisites 
  - The interval at which to poll that URL in milliseconds
  - The host and port the CA APM EPAgent is using for HTTP

Here is a sample param.json file with nginx and the EPAgent both running on the localhost:
```
    {
    	"pollInterval" : 5000,
    	"url" : "http://127.0.0.1/nginx_status",
    	"epahost" : "127.0.0.1",
    	"epaport" : 9191
    }
```

# Use the nginx Monitor
* Run the nginx Monitor by executing this command from the nginx Monitor installation directory:

    `node index`
	
Output appears on the console and in the Investigator.

# Metrics
The nginx Monitor reports these request metrics:
```
    nginx|hostname:Average Requests per Connection 
    nginx|hostname:Requests per Interval
```
	
The nginx Monitor reports these connection metrics:
```
    nginx|hostname|Connections:Active
    nginx|hostname|Connections:Idle
    nginx|hostname|Connections:Reading Request
    nginx|hostname|Connections:Writing Response
    nginx|hostname|Connections:Handled Connections
    nginx|hostname|Connections:Dropped Connections
```

The nginx Monitor with nginx Plus reportes these metrics:
```
    nginx|hostname:Average Requests per Connection 
    nginx|hostname:Requests per Interval
```   
```
    nginx|hostname|Connections:Active
    nginx|hostname|Connections:Idle
    nginx|hostname|Connections:Handled Connections
    nginx|hostname|Connections:Dropped Connections
```
```
    nginx|hostname|SSL:Handshakes per Interval
    nginx|hostname|SSL:Handshakes Failed per Interval
    nginx|hostname|SSL:Session Reuses per Interval
```
```
    nginx|hostname|Server Zone|zone:Requests per Interval
    nginx|hostname|Server Zone|zone:Responses per Interval
    nginx|hostname|Server Zone|zone:Discarded per Interval
    nginx|hostname|Server Zone|zone:Processing per Interval
	nginx|hostname|Server Zone|zone:Sent Bytes per Interval
	nginx|hostname|Server Zone|zone:Received Bytes per Interval
	nginx|hostname|Server Zone|zone|Responses:1xx per Interval
	nginx|hostname|Server Zone|zone|Responses:2xx per Interval
	nginx|hostname|Server Zone|zone|Responses:3xx per Interval
	nginx|hostname|Server Zone|zone|Responses:4xx per Interval
	nginx|hostname|Server Zone|zone|Responses:5xx per Interval
```
```
	nginx|hostname|Upstreams|group|server:Backup
	nginx|hostname|Upstreams|group|server:State
	nginx|hostname|Upstreams|group|server:Requests per Interval
	nginx|hostname|Upstreams|group|server:Weight
	nginx|hostname|Upstreams|group|server:Active Connections
	nginx|hostname|Upstreams|group|server:Sent Bytes per Interval
	nginx|hostname|Upstreams|group|server:Received Bytes per Interval
	nginx|hostname|Upstreams|group|server:Failures per Interval
	nginx|hostname|Upstreams|group|server:Unavailables per Interval
	nginx|hostname|Upstreams|group|server|Health Checks:Checks per Interval
	nginx|hostname|Upstreams|group|server|Health Checks:Failures per Interval
	nginx|hostname|Upstreams|group|server|Health Checks:Unhealthy per Interval
	nginx|hostname|Upstreams|group|server|Responses:1xx per Interval
	nginx|hostname|Upstreams|group|server|Responses:2xx per Interval
	nginx|hostname|Upstreams|group|server|Responses:3xx per Interval
	nginx|hostname|Upstreams|group|server|Responses:4xx per Interval
	nginx|hostname|Upstreams|group|server|Responses:5xx per Interval
```

# Debug and Troubleshoot
The console output indicates if the script is unable to contact the front-end web services or the EPAgent.  

# Support
This document and extension are made available from CA Technologies. They are provided as examples at no charge as a courtesy to the CA APM Community at large. This extension might require modification for use in your environment. However, this extension is not supported by CA Technologies, and inclusion in this site should not be construed to be an endorsement or recommendation by CA Technologies. This extension is not covered by the CA Technologies software license agreement and there is no explicit or implied warranty from CA Technologies. The extension can be used and distributed freely amongst the CA APM Community, but not sold. As such, it is unsupported software, provided as is without warranty of any kind, express or implied, including but not limited to warranties of merchantability and fitness for a particular purpose. CA Technologies does not warrant that this resource will meet your requirements or that the operation of the resource will be uninterrupted or error free or that any defects will be corrected. The use of this extension implies that you understand and agree to the terms listed herein.
Although this extension is unsupported, please let us know if you have any problems or questions. You can add comments to the CA APM Community site so that the author(s) can attempt to address the issue or question.
Unless explicitly stated otherwise this extension is only supported on the same platforms as the CA APM Java agent. 

# Support URL
https://github.com/tmcgaughey/nginx-epa/issues

# Product Compatibilty Matrix
http://pcm.ca.com/

# Categories
Packaged Applications

# Change Log
Changes for each monitor version.

Version | Author | Comment
--------|--------|--------
1.0 | Tim McGaughey | First version of the monitor.
2.0 | Tim McGaughey | Added support for nginx Plus.

