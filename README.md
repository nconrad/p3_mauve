# p3_mauve

Takes JSON and runs Mauve with provided options.

```
  Usage: p3-mauve [options]

  Options:

    -g, --genome-ids [value]       Genome IDs comma delimited
    --jstring [value]              Pass job params (json) as string
    --jfile [value]                Pass job params (json) as file
    --sstring [value]              Server config (json) as string
    -o, --output [value]           Where to save files/results
    -t, --tmp-files                Use temp files for fastas
```

Example:

```
p3-mauve \
    --jfile jobdesc.json \
    --sstring '{"data_api":"<end_point>"}' \
    -o test-data/
    
 ```
