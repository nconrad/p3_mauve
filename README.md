# p3_mauve

Takes Job Params (as JSON) and runs PATRIC Mauve.


## Requirements

- node (8.9.1+)
- npm (5.6.0+)

## Installation

```
cd p3_mauve
npm install
```


## Usage

```
  Usage: p3-mauve [options]

  Options:

    --jfile [value]                Pass job params (json) as file
    --sstring [value]              Server config (json) as string
    -o, --output [value]           Where to save files/results
```

Example:

```
p3-mauve \
    --jfile jobdesc.json \
    --sstring '{"data_api":"<end_point>"}' \
    -o test-data/

 ```

 where `jsfile.json` has format:


```javascript
{
    "genome_ids": ["204722.5", "224914.11", "262698.4"],
    "output_path": "/user@patricbrc.org/test/",
    "output_file": "test-mauve"
}
```

## Contributing

1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request

