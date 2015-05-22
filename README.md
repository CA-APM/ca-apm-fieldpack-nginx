# nginx monitor (1.0)

## Description
Monitors [nginx](http://nginx.org/en/ "nginx") status and reports metrics to the CA APM EPAgent REST interface.

## APM version
This has been tested with APM 9.7.1.  An EPAgent 9.7.1 or greater is required for the REST interface.

## Supported third party versions
nginx 1.6.3. --with-http_stub_status_module
node v0.10.38

## Limitations
This has not been tested with the commercial versions of nginx.  Commercial versions are supposed to publish additional metrics at the status URL.

## License
[Eclipse Public License 1.0](https://www.eclipse.org/legal/epl-v10.html "Eclipse Public License")


# Installation Instructions
Follow the steps below in prerequisites, installation, configuration, and usage to get up and running with nginx metrics today!

## Prerequisites
Ensure that nginx has the --with-http_stub_status_module flag by executing:

    nginx -V
The flag should appear in the output.

Ensure the status URL is enabled. In your active nginx config file, a status URL location must be enabled under your server block.  An example is provided below:

    
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

A RESTful CA APM EPAgent must be installed and the HTTP port must be set.  This should be reachable from the host that will be running this script.

## Dependencies
APM EPAgent 9.7.1+
node.js
nginx built with the --with-http_stub_status_module flag

## Installation
Simply copy the files to a convenient location.

## Configuration
Edit the param.json file to designate:

 - The status URL specified in the prerequisites 
 - The interval at which to poll that URL  
 - The host and port the CA APM EPAgent is using for HTTP.

Here is a sample param.json file with nginx and the EPAgent both running on the localhost:

    {
    	"pollInterval" : 1000,
    	"url" : "http://127.0.0.1/nginx_status",
    	"epahost" : "127.0.0.1",
    	"epaport" : 9191
    }


# Usage Instructions
Execute the fieldpack with:

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


## Custom Management Modules
None provided.

## Custom type viewers
None provided.

## Name Formatter Replacements
None provided.

## Debugging and Troubleshooting
The output on the console will indicate if the script is unable to contact either the front end web services, or  the EPAgent.  

## Support
This document and associated tools are made available from CA Technologies as examples and provided at no charge as a courtesy to the CA APM Community at large. This resource may require modification for use in your environment. However, please note that this resource is not supported by CA Technologies, and inclusion in this site should not be construed to be an endorsement or recommendation by CA Technologies. These utilities are not covered by the CA Technologies software license agreement and there is no explicit or implied warranty from CA Technologies. They can be used and distributed freely amongst the CA APM Community, but not sold. As such, they are unsupported software, provided as is without warranty of any kind, express or implied, including but not limited to warranties of merchantability and fitness for a particular purpose. CA Technologies does not warrant that this resource will meet your requirements or that the operation of the resource will be uninterrupted or error free or that any defects will be corrected. The use of this resource implies that you understand and agree to the terms listed herein.

Although these utilities are unsupported, please let us know if you have any problems or questions by adding a comment to the CA APM Community Site area where the resource is located, so that the Author(s) may attempt to address the issue or question.

Unless explicitly stated otherwise this field pack is only supported on the same platforms as the APM core agent. See [APM Compatibility Guide](http://www.ca.com/us/support/ca-support-online/product-content/status/compatibility-matrix/application-performance-management-compatibility-guide.aspx).


# Change log
Changes for each version of the field pack.

Version | Author | Comment
--------|--------|--------
1.0 | Tim McGaughey | First version of the field pack.


