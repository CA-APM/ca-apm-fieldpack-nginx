# nginx-epa
Node.js monitoring for Nginx to report to the CA REST EPAgent 

--with-http_stub_status_module is required in the nginx -V output

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

Configure which URL to query, what frequency, and which EPAgent to send
the data towards in the param.json file.

Usage: node index

The metrics will be default be reported under 'nginx|<hostname>|...'.  
