// Small multilingual stopword list so "signature words" aren't just "the" and "que".
const LISTS = {
  en: 'the and you that was for are with his they this have from one had word but not what all were when your can said there use each which she how their will other about out many then them these some her would make like him into time has look two more write see number way could people than first been call who its now find long down day did get come made may part yes yeah yea yep nope okay ok just also really very too got going know think want need what\'s it\'s i\'m don\'t that\'s can\'t didn\'t i\'ll you\'re we\'re there\'s doesn\'t isn\'t wasn\'t won\'t i\'ve let\'s here where why because still even well only back over after much any our ours off sure gonna wanna u ur im dont cant thats ill youre ive thanks thank lol omg idk tho though should would could shall might must does doing done being has having gets getting went go goes say says tell told something anything nothing everything someone anyone everyone',
  es: 'que los las del por con una para como pero sus más este esta esto ese eso hay muy sin sobre también fue han ser son está estás estoy tiene tengo todo todos bien cuando donde porque solo así entonces algo nada mismo ahora ya',
  pt: 'que não uma com para mais como mas dos das foi ele ela isso esse essa está estou tem tenho ser são muito também quando onde porque então tudo nada agora vou vai pra pro tá né aqui sim',
  de: 'und die der das ist nicht ich du sie wir ihr den dem ein eine einen mit auf für von zu es auch noch aber wie was wenn dann oder so schon nur mal doch ja nein bin bist hast habe hat wird kann',
  fr: 'les des une est pas que qui pour dans sur avec mais comme tout plus fait bien elle ils nous vous mon ton son cette ces aussi alors donc ça oui non très',
  it: 'che non una per con sono come anche più del della questo quello ma poi tutto fatto bene io tu lui lei noi voi',
  id: 'yang dan ini itu dengan untuk tidak ada aku kamu saya dia kita kami juga sudah akan bisa lagi aja gak nggak',
  hi: 'hai hain kya aur nahi bhi toh mein main tum aap yeh woh kar karo kuch hum ko ka ki ke se par na haan',
};
export const STOPWORDS = new Set(Object.values(LISTS).join(' ').split(/\s+/));
