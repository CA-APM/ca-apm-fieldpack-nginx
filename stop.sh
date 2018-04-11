#!/bin/bash
#jmeter headshot
kill `ps ax | grep 'index.js' | awk '{print $1}'`

