node-blerg
==========

A nodejs blerg client


Usage
=====

```
var blerg = require('blerg');

blerg.login('username', 'password', function(err) {
  blerg.put("Blerging from nodejs", function(err) {
    if(err) console.log("I tried but the blurg ain't blurgin', captian");
  });
  blerg.subscribe('ek', function(err) {
    if err console.log(err);
  });

});

// These don't require being logged in
blerg.info('ek', function(err, res){
  if(err) return console.log("No news is bad news");
  console.log("There are " + res.record_count + " records for ek");
});

blerg.get('ek', function(err, res) {
  if(err) return console.log("The signal seems fuzzy");
  if(res && res[0]) {
    console.log("Ek's most recent post is: '" + res[0].data + "' timestamped
    at " + res[0].timestamp);
  }
});
```

Basically, read the [api](http://blerg.cc/doc/#api) as put on blerg and just use
the path name as the method name. The username argument is only required for the
login call, all others will add it automatically.
