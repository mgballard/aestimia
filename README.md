[![Build Status](https://travis-ci.org/mozilla/aestimia.png)](https://travis-ci.org/mozilla/aestimia)

Aestimia allows a mentor community to assess work based on submitted
evidence and a rubric.

## Quick Start

    git clone git://github.com/mozilla/aestimia.git
    cd aestimia
    npm install
    npm test
    COOKIE_SECRET=supersecret node bin/aestimia.js

When deploying, you'll want to set `COOKIE_SECRET` to something super
secret.