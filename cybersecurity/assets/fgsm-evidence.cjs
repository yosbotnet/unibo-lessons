// Transcription, not locally reproduced attacks. Goodfellow et al., ICLR 2015,
// arXiv 1412.6572v3, section 4, printed p. 3 and footnotes 1–2.
module.exports={
 url:'https://arxiv.org/pdf/1412.6572v3',
 sha256:'7f6c0a50475149e11e3b7efc9c0a00383652b7cae62f80facd8ae2684ef251e7',
 rows:[
  {dataset:'MNIST',model:'Shallow softmax',errorPercent:99.9,meanScorePercent:79.3,epsilon:.25,units:'Pixel values in [0,1]'},
  {dataset:'MNIST',model:'Maxout',errorPercent:89.4,meanScorePercent:97.6,epsilon:.25,units:'Pixel values in [0,1]'},
  {dataset:'CIFAR-10',model:'Convolutional maxout',errorPercent:87.15,meanScorePercent:96.6,epsilon:.1,units:'Preprocessed inputs; standard deviation ≈ 0.5'}
 ],
 illustration:{model:'GoogLeNet',dataset:'ImageNet',cleanClass:'panda',cleanScorePercent:57.7,candidateClass:'gibbon',candidateScorePercent:99.3,epsilon:.007,unitContext:'GoogLeNet input encoding',count:1}
};
