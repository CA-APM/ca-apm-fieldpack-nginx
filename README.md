# nginx monitor (2.0)


# Description
Monitors [nginx](http://nginx.org/en/ "nginx") status and reports metrics to the CA APM EPAgent REST interface.

## Releases
From time to time, projects may make compiled releases available.  While source code is always available for complete build, releases serve as a "tag" (numbered release) and often contain prepared packages that are prebuilt and ready to use.  Visit `http://github.com/ca-apm/<repo_name>/releases` for details.

## APM version
This has been tested with APM 9.7.1.  An EPAgent 9.7.1 or greater is required for the REST interface.

## Supported third party versions
`nginx 1.6.3 --with-http_stub_status_module`

`node v0.10.38`

## Limitations
nginx open source with stub status module or nginx plus with the status module enabled

## License
[Eclipse Public License 1.0](https://www.eclipse.org/legal/epl-v10.html "Eclipse Public License")

Please review the 
**LICENSE**
file in this repository.  Licenses may vary by repository.  Your download and use of this software constitutes your agreement to this license.

# Installation Instructions
Follow the steps below in prerequisites, installation, configuration, and usage to get up and running with nginx metrics today!

## Prerequisites

### Open Source nginx
Ensure that nginx has the `--with-http_stub_status_module` flag by executing:

    nginx -V
The flag should appear in the output.

Using the value of the `--conf-path` flag in the output, identify your active [nginx config file](http://nginx.org/en/docs/beginners_guide.html#conf_structure).

A status URL location must be enabled under your server block.  An example is provided below:

    
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
If you test the URL, the expected output should look similar to the following:

    Active connections: 1
    server accepts handled requests
    112 112 121
    Reading: 0 Writing: 1 Waiting: 0

### nginx Plus
nginx Plus should use the status plugin: [live activity monitoring](https://www.nginx.com/products/live-activity-monitoring/)

If you test the status URL, the expected output is a JSON stream similar to the one at the [nginx demo site](http://demo.nginx.com/status)

### RESTful EPA
A [RESTful CA APM EPAgent](https://wiki.ca.com/display/APMDEVOPS97/EPAgent+Overview) must be installed and the [HTTP port must be set](https://wiki.ca.com/display/APMDEVOPS97/Configure+the+EPAgent+RESTful+Interface).  The host and port running the EPAgent should be reachable from the host that will be running this nginx monitoring script.

## Dependencies
 - APM EPAgent 9.7.1+
 - node.js


## Installation
Copy the **index.js** and **param.json** files to a convenient location.

From there, execute:

    npm install request

## Configuration
Edit the **param.json** file to designate:

 - The status URL specified in the prerequisites 
 - The interval at which to poll that URL in milliseconds
 - The host and port the CA APM EPAgent is using for HTTP

Here is a sample **param.json** file with nginx and the EPAgent both running on the localhost:

    {
    	"pollInterval" : 5000,
    	"url" : "http://127.0.0.1/nginx_status",
    	"epahost" : "127.0.0.1",
    	"epaport" : 9191
    }


# Usage Instructions
From the installation location, execute the fieldpack with:

    node index
Output will appear on the console, and hopefully the Introscope Investigator as well!

## Metric description
Reports the following metrics for requests:

    nginx|hostname:Average Requests per Connection 
    nginx|hostname:Requests per Interval

plus the following metrics for connections: 

    nginx|hostname|Connections:Active
    nginx|hostname|Connections:Idle
    nginx|hostname|Connections:Reading Request
    nginx|hostname|Connections:Writing Response
    nginx|hostname|Connections:Handled Connections
    nginx|hostname|Connections:Dropped Connections

With nginx Plus, the reported metrics are:
    nginx|hostname:Average Requests per Connection 
    nginx|hostname:Requests per Interval
    
    nginx|hostname|Connections:Active
    nginx|hostname|Connections:Idle
    nginx|hostname|Connections:Handled Connections
    nginx|hostname|Connections:Dropped Connections

    nginx|hostname|SSL:Handshakes per Interval
    nginx|hostname|SSL:Handshakes Failed per Interval
    nginx|hostname|SSL:Session Reuses per Interval

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
	
	
## Custom Management Modules
None provided.

## Custom type viewers
None provided.

## Name Formatter Replacements
None provided.

## Debugging and Troubleshooting
The output on the console will indicate if the script is unable to contact either the front end web services, or the EPAgent.  

## Support
This document and associated tools are made available from CA Technologies as examples and provided at no charge as a courtesy to the CA APM Community at large. This resource may require modification for use in your environment. However, please note that this resource is not supported by CA Technologies, and inclusion in this site should not be construed to be an endorsement or recommendation by CA Technologies. These utilities are not covered by the CA Technologies software license agreement and there is no explicit or implied warranty from CA Technologies. They can be used and distributed freely amongst the CA APM Community, but not sold. As such, they are unsupported software, provided as is without warranty of any kind, express or implied, including but not limited to warranties of merchantability and fitness for a particular purpose. CA Technologies does not warrant that this resource will meet your requirements or that the operation of the resource will be uninterrupted or error free or that any defects will be corrected. The use of this resource implies that you understand and agree to the terms listed herein.

Although these utilities are unsupported, please let us know if you have any problems or questions by adding a comment to the CA APM Community Site area where the resource is located, so that the Author(s) may attempt to address the issue or question.

Unless explicitly stated otherwise this field pack is only supported on the same platforms as the APM core agent. See [APM Compatibility Guide](http://www.ca.com/us/support/ca-support-online/product-content/status/compatibility-matrix/application-performance-management-compatibility-guide.aspx).


# Contributing
The [CA APM Community](https://communities.ca.com/community/ca-apm) is the primary means of interfacing with other users and with the CA APM product team.  The [developer subcommunity](https://communities.ca.com/community/ca-apm/ca-developer-apm) is where you can learn more about building APM-based assets, find code examples, and ask questions of other developers and the CA APM product team.

If you wish to contribute to this or any other project, please refer to [easy instructions](https://communities.ca.com/docs/DOC-231150910) available on the CA APM Developer Community.


# Change log
Changes for each version of the field pack.

Version | Author | Comment
--------|--------|--------
1.0 | Tim McGaughey | First version of the field pack.
2.0 | Tim McGaughey | Added support for nginx Plus.

## Support URL
https://github.com/tmcgaughey/nginx-epa/issues

## Short Description
Monitor nginx web server

## Categories
Packaged Applications
