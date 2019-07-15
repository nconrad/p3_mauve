
/**
 * Helpers related to Genome Alignment research/workflows
 *
 * Notes:
 *  - This is not used in the PATRIC Genome Alignment service
 *  - fasta/GBK stuff uses file streaming.
 */

const axios = require('axios');
const fs = require('fs');
const process = require('process');

const api = 'https://p3.theseed.org/services/data_api';

const featureSelect = [
  'pgfam_id',
  'patric_id', 'sequence_id', 'start', 'end',
  'strand', 'annotation', 'feature_type',
  'product', 'accession', 'refseq_locus_tag', 'gene'
];

const contigSelect = [
  'topology', 'gi', 'accession', 'length',
  'sequence_id', 'gc_content', 'chromosome',
  'sequence_type', 'chromosome', 'description'
];


function getFeatures(genomeIDs) {
  genomeIDs = Array.isArray(genomeIDs) ? genomeIDs : [genomeIDs];

  let proms = genomeIDs.map(id => {
      let url = `${api}/genome_feature/?eq(genome_id,${id})` +
          `&select(${featureSelect})&eq(annotation,PATRIC)&ne(feature_type,source)&limit(25000)`;
      return axios.get(url).then(res => res.data);
  });

  return axios.all(proms);
}

function getContigs(genomeIDs) {
  genomeIDs = Array.isArray(genomeIDs) ? genomeIDs : [genomeIDs];

  let proms = genomeIDs.map(id => {
      let url = `${api}/genome_sequence/?eq(genome_id,${id})` +
          `&select(${contigSelect.join(',')})&sort(-length,+sequence_id)&limit(25000)`;
      return axios.get(url).then(res => res.data);
  });

  return axios.all(proms);
}


async function getGBK({genomeID, outDir, suffix}) {
  console.log(`Fetching GTO for ${genomeID}...`);
  try {
    await spawnPromise('p3-gto', [genomeID, '-o', outDir]);
  } catch (e) {
    console.error('Error fetching GTO.', e);
  }

  console.log(`Creating .gbk file for ${genomeID}...`);
  let gbkPath;
  try {
    gbkPath = `${outDir}/${genomeID}${suffix ? `.${suffix}` : ''}.gbk`;
    await spawnPromise('rast-export-genome',
      ['-i', `${outDir}/${genomeID}.gto`, '-o', gbkPath, 'genbank']);
  } catch (e) {
    console.error('Error exporting to GBK.', e);
  }

  return gbkPath;
}


async function getGenomeFastas({endpoint, genomeIDs, outDir, suffix} ) {
  genomeIDs = Array.isArray(genomeIDs) ? genomeIDs : [genomeIDs];

  let paths = [];

  // for each id, fetch fasta
  for (const id of genomeIDs) {
    console.log(`Fetching genome: ${id}`)
    try {
      let url = `${endpoint || DEFAULT_ENDPOINT}/genome_sequence/?eq(genome_id,${id})` +
        `&sort(-length,+sequence_id)&limit(25000)`;
      let path = `${outDir}/${id}` + (suffix ? `.${suffix}` : '')  + `.fasta`;

      await streamFile(url, path).then(path => { paths.push(path); })
    } catch(err) {
      console.error(
        'Error fetching genome from Data API:',
        'message' in err ? err.message : err
      );
      console.error('Ending.');
      process.exit(1);
    }
  }

  return paths;
}

const fastaOpts = {
  responseType: 'stream',
  headers: {
    'accept': 'application/dna+fasta',
    'authorization': process.env.KB_AUTH_TOKEN || ''
  }
}

function streamFile(url, path) {
  return axios.get(url, fastaOpts)
    .then(res => {
      console.log(`Writing ${path}...`);
      let stream = fs.createWriteStream(path);
      res.data.pipe(stream);
      return new Promise((resolve, reject) => {
        stream.on('finish', () => { resolve(path) });
        stream.on('error', reject);
      });
    });
}


module.exports = {
  getGenomeFastas,
  getGBK,
  getContigs,
  getFeatures
}

