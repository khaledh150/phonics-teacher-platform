// Phonics World - Level 1 Data
// Based on the Phonics Workbook Level 1 - 20 Sound Groups

import { getGroupWordNames, getGroupSentencePics } from '../utils/assetHelpers';

export const PHONICS_GROUPS = [
  {
    id: 1,
    title: "Group 1",
    sounds: ["s", "a", "t", "i", "p", "n"],
    color: "#FF6B9D", // Pink
    icon: "🎀",
    words: [
      { word: "sat", image: "sat", sentence: "The cat sat on the mat." },
      { word: "pan", image: "pan", sentence: "She cooks eggs in a pan." },
      { word: "pin", image: "pin", sentence: "She has a safety pin." },
      { word: "sip", image: "sip", sentence: "I sip water." },
      { word: "nap", image: "nap", sentence: "The baby takes a nap." },
      { word: "tan", image: "tan", sentence: "He has a brown tan." },
      { word: "tin", image: "tin", sentence: "Cookies are in the tin." },
      { word: "pit", image: "pit", sentence: "He fell into a pit." },
      { word: "sap", image: "sap", sentence: "The tree has sticky sap." },
      { word: "ant", image: "ant", sentence: "I see an ant on the ground." },
    ],
    exercises: {
      fillBlank: [
        { sentence: "I ___ water.", answer: "sip", options: ["sip", "sat", "pan"] },
        { sentence: "She has a safety ___.", answer: "pin", options: ["pin", "pan", "pit"] },
        { sentence: "Cookies are in the ___.", answer: "tin", options: ["tin", "tan", "nap"] },
        { sentence: "The baby takes a ___.", answer: "nap", options: ["nap", "tap", "sap"] },
      ],
    },
  },
  {
    id: 2,
    title: "Group 2",
    sounds: ["c", "k", "e", "h", "r", "m", "d"],
    color: "#4ECDC4", // Teal
    icon: "🐔",
    words: [
      { word: "pen", image: "pen", sentence: "I write with my pen." },
      { word: "man", image: "man", sentence: "He is a tall man." },
      { word: "hen", image: "hen", sentence: "The hen lays eggs." },
      { word: "cap", image: "cap", sentence: "I wear a red cap." },
      { word: "map", image: "map", sentence: "She looked at the map to find the zoo." },
      { word: "pet", image: "pet", sentence: "I love my pet dog." },
      { word: "mad", image: "mad", sentence: "The boy is mad." },
      { word: "kit", image: "kit", sentence: "She brings her art kit." },
      { word: "ham", image: "ham", sentence: "I eat ham and eggs." },
      { word: "cam", image: "cam", sentence: "I open the cam." },
      { word: "red", image: "red", sentence: "The apple is red." },
    ],
    exercises: {
      fillBlank: [
        { sentence: "I wear a red ___.", answer: "cap", options: ["cap", "map", "ham"] },
        { sentence: "The ___ lays eggs.", answer: "hen", options: ["hen", "pen", "men"] },
        { sentence: "He is a tall ___.", answer: "man", options: ["man", "map", "mad"] },
        { sentence: "I write with my ___.", answer: "pen", options: ["pen", "pet", "hen"] },
        { sentence: "She brings her art ___.", answer: "kit", options: ["kit", "cap", "cam"] },
      ],
    },
  },
  {
    id: 3,
    title: "Group 3",
    sounds: ["g", "o", "u", "l", "f", "b"],
    color: "#FFE66D", // Yellow
    icon: "🐕",
    words: [
      { word: "dog", image: "dog", sentence: "The dog barked at the stranger." },
      { word: "sun", image: "sun", sentence: "The sun is shining brightly today." },
      { word: "bug", image: "bug", sentence: "A bug crawled on the table." },
      { word: "hot", image: "hot", sentence: "The soup is very hot, be careful!" },
      { word: "fat", image: "fat", sentence: "The fat cat slept all day." },
      { word: "lip", image: "lip", sentence: "She put on pink lipstick on her lip." },
      { word: "lit", image: "lit", sentence: "He lit a candle when it got dark." },
      { word: "tag", image: "tag", sentence: "I found a price tag on the shirt." },
      { word: "led", image: "led", sentence: "She led the team to victory." },
      { word: "ban", image: "ban", sentence: "They ban plastic bags in this store." },
    ],
    exercises: {
      fillBlank: [
        { sentence: "The ___ barked at the stranger.", answer: "dog", options: ["dog", "bug", "log"] },
        { sentence: "The ___ is shining brightly today.", answer: "sun", options: ["sun", "bun", "fun"] },
        { sentence: "A ___ crawled on the table.", answer: "bug", options: ["bug", "mug", "rug"] },
        { sentence: "The soup is very ___.", answer: "hot", options: ["hot", "pot", "lot"] },
        { sentence: "He ___ a candle when it got dark.", answer: "lit", options: ["lit", "bit", "sit"] },
      ],
    },
  },
  {
    id: 4,
    title: "Group 4",
    sounds: ["ai", "ay", "a-e"],
    subtitle: "Long Vowel A",
    color: "#FF8A5B", // Orange
    icon: "🎂",
    words: [
      { word: "rain", image: "rain", sentence: "I use an umbrella in the rain." },
      { word: "nail", image: "nail", sentence: "Dad hits the nail with a hammer." },
      { word: "tail", image: "tail", sentence: "The dog has a long tail." },
      { word: "cake", image: "cake", sentence: "She eats a big cake." },
      { word: "bake", image: "bake", sentence: "Mom will bake a pie." },
      { word: "lake", image: "lake", sentence: "We swim in the lake." },
      { word: "hay", image: "hay", sentence: "The cow eats hay." },
      { word: "pay", image: "pay", sentence: "I will pay for the book." },
      { word: "say", image: "say", sentence: "I want to say hello." },
      { word: "fail", image: "fail", sentence: "Don't be sad if you fail." },
    ],
    exercises: {
      fillBlank: [
        { sentence: "I will ___ for the book.", answer: "pay", options: ["pay", "say", "hay"] },
        { sentence: "The cow eats ___.", answer: "hay", options: ["hay", "pay", "day"] },
        { sentence: "We swim in the ___.", answer: "lake", options: ["lake", "cake", "bake"] },
        { sentence: "The dog has a long ___.", answer: "tail", options: ["tail", "nail", "rail"] },
        { sentence: "Mom will ___ a pie.", answer: "bake", options: ["bake", "cake", "lake"] },
      ],
    },
  },
  {
    id: 5,
    title: "Group 5",
    sounds: ["j"],
    color: "#9B59B6", // Purple
    icon: "🍯",
    words: [
      { word: "jam", image: "jam", sentence: "I like strawberry jam." },
      { word: "jet", image: "jet", sentence: "The jet flies fast." },
      { word: "jug", image: "jug", sentence: "She drinks milk from a jug." },
      { word: "jab", image: "jab", sentence: "I got a jab at the clinic." },
      { word: "jig", image: "jig", sentence: "The kids did a funny jig." },
      { word: "jot", image: "jot", sentence: "I will jot down your name." },
      { word: "jay", image: "jay", sentence: "A jay is a blue bird." },
      { word: "jail", image: "jail", sentence: "He is in jail now." },
      { word: "job", image: "job", sentence: "My dad has a new job." },
      { word: "jade", image: "jade", sentence: "She has a green jade ring." },
    ],
    exercises: {
      fillBlank: [
        { sentence: "I like strawberry ___.", answer: "jam", options: ["jam", "jab", "jug"] },
        { sentence: "The ___ flies fast.", answer: "jet", options: ["jet", "jot", "jig"] },
        { sentence: "She drinks milk from a ___.", answer: "jug", options: ["jug", "jam", "job"] },
        { sentence: "A ___ is a blue bird.", answer: "jay", options: ["jay", "jab", "jam"] },
        { sentence: "My dad has a new ___.", answer: "job", options: ["job", "jab", "jot"] },
      ],
    },
  },
  {
    id: 6,
    title: "Group 6",
    sounds: ["oa", "ow", "o-e"],
    subtitle: "Long Vowel O",
    color: "#3498DB", // Blue
    icon: "🐐",
    words: [
      { word: "goat", image: "goat", sentence: "The goat is eating grass." },
      { word: "boat", image: "boat", sentence: "We ride a boat on the lake." },
      { word: "soap", image: "soap", sentence: "She washes her hands with soap." },
      { word: "cone", image: "cone", sentence: "He eats ice cream in a cone." },
      { word: "bone", image: "bone", sentence: "The dog chews a bone." },
      { word: "home", image: "home", sentence: "I go home after school." },
      { word: "bowl", image: "bowl", sentence: "I put rice in a bowl." },
      { word: "mow", image: "mow", sentence: "I will mow the grass today." },
      { word: "low", image: "low", sentence: "The sun is low in the sky." },
      { word: "rope", image: "rope", sentence: "He pulls the rope hard." },
    ],
    exercises: {
      fillBlank: [
        { sentence: "The ___ is eating grass.", answer: "goat", options: ["goat", "boat", "coat"] },
        { sentence: "We ride a ___ on the lake.", answer: "boat", options: ["boat", "goat", "coat"] },
        { sentence: "I go ___ after school.", answer: "home", options: ["home", "bone", "cone"] },
        { sentence: "The dog chews a ___.", answer: "bone", options: ["bone", "cone", "home"] },
        { sentence: "I will ___ the grass today.", answer: "mow", options: ["mow", "low", "bow"] },
      ],
    },
  },
  {
    id: 7,
    title: "Group 7",
    sounds: ["ie", "y", "igh", "i-e"],
    subtitle: "Long Vowel I",
    color: "#E74C3C", // Red
    icon: "🚲",
    words: [
      { word: "tie", image: "tie", sentence: "I tie my shoes." },
      { word: "pie", image: "pie", sentence: "She eats a pie." },
      { word: "die", image: "die", sentence: "Flowers die without water." },
      { word: "sky", image: "sky", sentence: "The sky is blue." },
      { word: "cry", image: "cry", sentence: "Babies cry when they are hungry." },
      { word: "bike", image: "bike", sentence: "I ride my bike to school." },
      { word: "high", image: "high", sentence: "The bird flies high." },
      { word: "light", image: "light", sentence: "Turn on the light." },
      { word: "ride", image: "ride", sentence: "This is my new ride." },
      { word: "right", image: "right", sentence: "You are right!" },
    ],
    exercises: {
      fillBlank: [
        { sentence: "I ___ my shoes.", answer: "tie", options: ["tie", "pie", "lie"] },
        { sentence: "The ___ is blue.", answer: "sky", options: ["sky", "cry", "fly"] },
        { sentence: "I ride my ___ to school.", answer: "bike", options: ["bike", "hike", "like"] },
        { sentence: "Turn on the ___.", answer: "light", options: ["light", "right", "night"] },
        { sentence: "Babies ___ when they are hungry.", answer: "cry", options: ["cry", "try", "fly"] },
      ],
    },
  },
  {
    id: 8,
    title: "Group 8",
    sounds: ["ee", "ea", "e-e"],
    subtitle: "Long Vowel E",
    color: "#2ECC71", // Green
    icon: "👣",
    words: [
      { word: "feet", image: "feet", sentence: "Wash your feet." },
      { word: "beef", image: "beef", sentence: "I like beef and rice." },
      { word: "heel", image: "heel", sentence: "My heel hurts." },
      { word: "eat", image: "eat", sentence: "I want to eat a banana." },
      { word: "seat", image: "seat", sentence: "This is your seat." },
      { word: "sea", image: "sea", sentence: "We swim in the sea." },
      { word: "seed", image: "seed", sentence: "She plants a seed in the soil." },
      { word: "gene", image: "gene", sentence: "A gene comes from your parents." },
      { word: "delete", image: "delete", sentence: "Please delete that file." },
      { word: "theme", image: "theme", sentence: "The party has a fun theme." },
    ],
    exercises: {
      fillBlank: [
        { sentence: "My ___ hurts.", answer: "heel", options: ["heel", "feel", "peel"] },
        { sentence: "I like ___ and rice.", answer: "beef", options: ["beef", "reef", "leaf"] },
        { sentence: "Wash your ___.", answer: "feet", options: ["feet", "meet", "beet"] },
        { sentence: "We swim in the ___.", answer: "sea", options: ["sea", "tea", "pea"] },
        { sentence: "She plants a ___ in the soil.", answer: "seed", options: ["seed", "feed", "weed"] },
      ],
    },
  },
  {
    id: 9,
    title: "Group 9",
    sounds: ["or", "al", "au", "aw"],
    color: "#F39C12", // Gold
    icon: "⚖️",
    words: [
      { word: "fork", image: "fork", sentence: "Use a fork to eat noodles." },
      { word: "form", image: "form", sentence: "Please fill out this form." },
      { word: "corn", image: "corn", sentence: "I like sweet corn." },
      { word: "jaw", image: "jaw", sentence: "He hurt his jaw." },
      { word: "law", image: "law", sentence: "We must follow the law." },
      { word: "ball", image: "ball", sentence: "He kicked the ball." },
      { word: "wall", image: "wall", sentence: "The picture is on the wall." },
      { word: "call", image: "call", sentence: "I will call you later." },
      { word: "fault", image: "fault", sentence: "It was not your fault." },
      { word: "Paul", image: "paul", sentence: "Paul is my friend." },
    ],
    exercises: {
      fillBlank: [
        { sentence: "Use a ___ to eat noodles.", answer: "fork", options: ["fork", "form", "fort"] },
        { sentence: "He kicked the ___.", answer: "ball", options: ["ball", "call", "wall"] },
        { sentence: "We must follow the ___.", answer: "law", options: ["law", "jaw", "paw"] },
        { sentence: "I like sweet ___.", answer: "corn", options: ["corn", "horn", "born"] },
        { sentence: "The picture is on the ___.", answer: "wall", options: ["wall", "ball", "call"] },
      ],
    },
  },
  {
    id: 10,
    title: "Group 10",
    sounds: ["z", "w", "ng"],
    color: "#1ABC9C", // Turquoise
    icon: "⭐",
    words: [
      { word: "zip", image: "zip", sentence: "I pull the zip on my bag." },
      { word: "wag", image: "wag", sentence: "The dog will wag its tail." },
      { word: "king", image: "king", sentence: "The king sits on the throne." },
      { word: "zap", image: "zap", sentence: "I saw a light zap in the game." },
      { word: "wig", image: "wig", sentence: "She wears a red wig." },
      { word: "long", image: "long", sentence: "The rope is very long." },
      { word: "ring", image: "ring", sentence: "I found a ring on the floor." },
      { word: "bang", image: "bang", sentence: "We heard a loud bang outside." },
      { word: "wet", image: "wet", sentence: "My shirt is wet from the rain." },
      { word: "buzz", image: "buzz", sentence: "The bee makes a buzz sound." },
    ],
    exercises: {
      fillBlank: [
        { sentence: "I pull the ___ on my bag.", answer: "zip", options: ["zip", "zap", "zig"] },
        { sentence: "The ___ sits on the throne.", answer: "king", options: ["king", "ring", "sing"] },
        { sentence: "The dog will ___ its tail.", answer: "wag", options: ["wag", "bag", "tag"] },
        { sentence: "The rope is very ___.", answer: "long", options: ["long", "song", "gong"] },
        { sentence: "The bee makes a ___ sound.", answer: "buzz", options: ["buzz", "fuzz", "jazz"] },
      ],
    },
  },
  {
    id: 11,
    title: "Group 11",
    sounds: ["oo", "ooo"],
    subtitle: "Short & Long OO",
    color: "#8E44AD", // Deep Purple
    icon: "👑",
    words: [
      { word: "book", image: "book", sentence: "This is my favorite book." },
      { word: "wood", image: "wood", sentence: "The table is made of wood." },
      { word: "food", image: "food", sentence: "I like to eat good food." },
      { word: "moon", image: "moon", sentence: "The moon is bright tonight." },
      { word: "zoo", image: "zoo", sentence: "We went to the zoo today." },
      { word: "root", image: "root", sentence: "The tree has a big root." },
      { word: "cook", image: "cook", sentence: "I help my mom cook rice." },
      { word: "hook", image: "hook", sentence: "Hang your bag on the hook." },
      { word: "foot", image: "foot", sentence: "I hurt my foot." },
      { word: "roof", image: "roof", sentence: "The cat is on the roof." },
    ],
    exercises: {
      fillBlank: [
        { sentence: "We went to the ___ today.", answer: "zoo", options: ["zoo", "too", "moo"] },
        { sentence: "The ___ is bright tonight.", answer: "moon", options: ["moon", "noon", "soon"] },
        { sentence: "This is my favorite ___.", answer: "book", options: ["book", "cook", "look"] },
        { sentence: "The cat is on the ___.", answer: "roof", options: ["roof", "hoof", "proof"] },
        { sentence: "I help my mom ___ rice.", answer: "cook", options: ["cook", "book", "hook"] },
      ],
    },
  },
  {
    id: 12,
    title: "Group 12",
    sounds: ["v", "y", "x"],
    color: "#27AE60", // Emerald
    icon: "📚",
    words: [
      { word: "vet", image: "vet", sentence: "The vet helps sick pets." },
      { word: "van", image: "van", sentence: "Dad drives a van." },
      { word: "vex", image: "vex", sentence: "Loud noise can vex me." },
      { word: "yam", image: "yam", sentence: "I eat a yam for lunch." },
      { word: "yap", image: "yap", sentence: "Dogs often yap when excited." },
      { word: "yes", image: "yes", sentence: "Yes, I like apples." },
      { word: "six", image: "six", sentence: "She is six years old." },
      { word: "fix", image: "fix", sentence: "I will fix my toy." },
      { word: "mix", image: "mix", sentence: "I will mix the colors." },
      { word: "box", image: "box", sentence: "The cat is in the box." },
    ],
    exercises: {
      fillBlank: [
        { sentence: "The ___ helps sick pets.", answer: "vet", options: ["vet", "pet", "wet"] },
        { sentence: "Dad drives a ___.", answer: "van", options: ["van", "can", "man"] },
        { sentence: "She is ___ years old.", answer: "six", options: ["six", "mix", "fix"] },
        { sentence: "The cat is in the ___.", answer: "box", options: ["box", "fox", "sox"] },
        { sentence: "I will ___ the colors.", answer: "mix", options: ["mix", "fix", "six"] },
      ],
    },
  },
  {
    id: 13,
    title: "Group 13",
    sounds: ["ch", "sh"],
    color: "#E67E22", // Carrot
    icon: "📦",
    words: [
      { word: "chip", image: "chip", sentence: "I eat one chip." },
      { word: "chat", image: "chat", sentence: "They chat after school." },
      { word: "chop", image: "chop", sentence: "Dad will chop the wood." },
      { word: "chin", image: "chin", sentence: "He has a strong chin." },
      { word: "cash", image: "cash", sentence: "She pays with cash." },
      { word: "ship", image: "ship", sentence: "The ship sails on the sea." },
      { word: "shop", image: "shop", sentence: "We go to the shop." },
      { word: "shin", image: "shin", sentence: "He bumped his shin." },
      { word: "shot", image: "shot", sentence: "She took a good shot." },
      { word: "rash", image: "rash", sentence: "He has a rash on his arm." },
      { word: "lash", image: "lash", sentence: "She has a long lash." },
    ],
    exercises: {
      fillBlank: [
        { sentence: "I eat one ___.", answer: "chip", options: ["chip", "ship", "skip"] },
        { sentence: "We go to the ___.", answer: "shop", options: ["shop", "chop", "stop"] },
        { sentence: "The ___ sails on the sea.", answer: "ship", options: ["ship", "chip", "skip"] },
        { sentence: "She pays with ___.", answer: "cash", options: ["cash", "rash", "lash"] },
        { sentence: "They ___ after school.", answer: "chat", options: ["chat", "chop", "chip"] },
      ],
    },
  },
  {
    id: 14,
    title: "Group 14",
    sounds: ["th", "thh"],
    color: "#16A085", // Sea Green
    icon: "🐚",
    words: [
      { word: "thick", image: "thick", sentence: "The book is very thick." },
      { word: "three", image: "three", sentence: "I see three birds." },
      { word: "this", image: "this", sentence: "This is my pen." },
      { word: "that", image: "that", sentence: "I like that toy." },
      { word: "thin", image: "thin", sentence: "The paper is thin." },
      { word: "them", image: "them", sentence: "I like all of them." },
      { word: "then", image: "then", sentence: "We eat, then we play." },
      { word: "with", image: "with", sentence: "I play with my friend." },
      { word: "bath", image: "bath", sentence: "I take a bath every night." },
      { word: "math", image: "math", sentence: "I am good at math." },
      { word: "moth", image: "moth", sentence: "A moth flew to the light." },
      { word: "these", image: "these", sentence: "I want these toys." },
      { word: "things", image: "things", sentence: "Put your things away." },
    ],
    exercises: {
      fillBlank: [
        { sentence: "I see ___ birds.", answer: "three", options: ["three", "tree", "free"] },
        { sentence: "The paper is ___.", answer: "thin", options: ["thin", "then", "them"] },
        { sentence: "___ is my pen.", answer: "this", options: ["this", "that", "them"] },
        { sentence: "I am good at ___.", answer: "math", options: ["math", "moth", "that"] },
        { sentence: "We eat, ___ we play.", answer: "then", options: ["then", "them", "that"] },
      ],
    },
  },
  {
    id: 15,
    title: "Group 15",
    sounds: ["qu"],
    color: "#D35400", // Pumpkin
    icon: "👸",
    words: [
      { word: "quiz", image: "quiz", sentence: "I took a quiz at school." },
      { word: "quiet", image: "quiet", sentence: "Please be quiet in class." },
      { word: "quilt", image: "quilt", sentence: "Grandma made a quilt." },
      { word: "quill", image: "quill", sentence: "I saw a quill on the table." },
      { word: "quit", image: "quit", sentence: "He wants to quit the game." },
      { word: "quest", image: "quest", sentence: "We go on a quest for treasure." },
      { word: "queen", image: "queen", sentence: "The queen wears a crown." },
      { word: "quick", image: "quick", sentence: "He gave a quick answer." },
      { word: "quack", image: "quack", sentence: "The duck says quack." },
      { word: "Quin", image: "quin", sentence: "Quin is my friend." },
    ],
    exercises: {
      fillBlank: [
        { sentence: "I took a ___ at school.", answer: "quiz", options: ["quiz", "quit", "quin"] },
        { sentence: "Please be ___ in class.", answer: "quiet", options: ["quiet", "quit", "quiz"] },
        { sentence: "The ___ wears a crown.", answer: "queen", options: ["queen", "green", "seen"] },
        { sentence: "He wants to ___ the game.", answer: "quit", options: ["quit", "quiz", "quin"] },
        { sentence: "___ is my friend.", answer: "Quin", options: ["Quin", "queen", "quiz"] },
      ],
    },
  },
  {
    id: 16,
    title: "Group 16",
    sounds: ["ou", "ow"],
    color: "#C0392B", // Pomegranate
    icon: "🦉",
    words: [
      { word: "owl", image: "owl", sentence: "An owl sits on the tree." },
      { word: "fowl", image: "fowl", sentence: "A fowl walks near the farm." },
      { word: "down", image: "down", sentence: "He fell down the hill." },
      { word: "town", image: "town", sentence: "We live in a small town." },
      { word: "cow", image: "cow", sentence: "The cow eats grass." },
      { word: "cloud", image: "cloud", sentence: "A big cloud is in the sky." },
      { word: "loud", image: "loud", sentence: "The music is too loud." },
      { word: "count", image: "count", sentence: "Can you count to ten?" },
      { word: "round", image: "round", sentence: "The ball is round." },
      { word: "house", image: "house", sentence: "This is my house." },
      { word: "couch", image: "couch", sentence: "I sit on the couch." },
      { word: "howl", image: "howl", sentence: "The wolf likes to howl." },
      { word: "mouth", image: "mouth", sentence: "Open your mouth wide." },
      { word: "out", image: "out", sentence: "The cat ran out the door." },
      { word: "pouch", image: "pouch", sentence: "The kangaroo has a pouch." },
      { word: "south", image: "south", sentence: "Birds fly south in winter." },
    ],
    exercises: {
      fillBlank: [
        { sentence: "An ___ sits on the tree.", answer: "owl", options: ["owl", "howl", "fowl"] },
        { sentence: "The ___ eats grass.", answer: "cow", options: ["cow", "how", "now"] },
        { sentence: "The music is too ___.", answer: "loud", options: ["loud", "out", "south"] },
        { sentence: "A ___ walks near the farm.", answer: "fowl", options: ["fowl", "owl", "howl"] },
        { sentence: "Open your ___.", answer: "mouth", options: ["mouth", "south", "out"] },
      ],
    },
  },
  {
    id: 17,
    title: "Group 17",
    sounds: ["oi", "oy"],
    color: "#7F8C8D", // Concrete
    icon: "🧸",
    words: [
      { word: "oil", image: "oil", sentence: "I put oil in the pan." },
      { word: "coin", image: "coin", sentence: "He found a coin on the ground." },
      { word: "boil", image: "boil", sentence: "I will boil the eggs." },
      { word: "soil", image: "soil", sentence: "The plant grows in the soil." },
      { word: "foil", image: "foil", sentence: "Wrap the food in foil." },
      { word: "boy", image: "boy", sentence: "The boy is playing." },
      { word: "joy", image: "joy", sentence: "She smiled with joy." },
      { word: "toy", image: "toy", sentence: "This is my new toy." },
      { word: "royal", image: "royal", sentence: "The royal crown is gold." },
      { word: "loyal", image: "loyal", sentence: "Dogs are loyal pets." },
    ],
    exercises: {
      fillBlank: [
        { sentence: "I put ___ in the pan.", answer: "oil", options: ["oil", "foil", "coil"] },
        { sentence: "The plant grows in the ___.", answer: "soil", options: ["soil", "toil", "foil"] },
        { sentence: "The ___ is playing.", answer: "boy", options: ["boy", "toy", "joy"] },
        { sentence: "She smiled with ___.", answer: "joy", options: ["joy", "boy", "toy"] },
        { sentence: "He found a ___ on the ground.", answer: "coin", options: ["coin", "foil", "boil"] },
      ],
    },
  },
  {
    id: 18,
    title: "Group 18",
    sounds: ["ue", "ew", "u-e"],
    subtitle: "Long Vowel U",
    color: "#2980B9", // Belize Hole
    icon: "✈️",
    words: [
      { word: "clue", image: "clue", sentence: "I found a clue in the game." },
      { word: "glue", image: "glue", sentence: "She used glue to fix the paper." },
      { word: "blue", image: "blue", sentence: "He wears a blue shirt." },
      { word: "true", image: "true", sentence: "The story is true." },
      { word: "drew", image: "drew", sentence: "She drew a cat." },
      { word: "flew", image: "flew", sentence: "The bird flew away." },
      { word: "blew", image: "blew", sentence: "The wind blew hard." },
      { word: "rude", image: "rude", sentence: "Don't be rude to others." },
      { word: "June", image: "june", sentence: "School starts in June." },
      { word: "rule", image: "rule", sentence: "Follow the rule." },
    ],
    exercises: {
      fillBlank: [
        { sentence: "I found a ___ in the game.", answer: "clue", options: ["clue", "blue", "glue"] },
        { sentence: "He wears a ___ shirt.", answer: "blue", options: ["blue", "true", "glue"] },
        { sentence: "The bird ___ away.", answer: "flew", options: ["flew", "blew", "drew"] },
        { sentence: "Follow the ___.", answer: "rule", options: ["rule", "rude", "June"] },
        { sentence: "The story is ___.", answer: "true", options: ["true", "blue", "clue"] },
      ],
    },
  },
  {
    id: 19,
    title: "Group 19",
    sounds: ["er", "ir", "ur"],
    color: "#9B59B6", // Amethyst
    icon: "🐦",
    words: [
      { word: "river", image: "river", sentence: "The river flows fast." },
      { word: "fern", image: "fern", sentence: "A fern grows near the tree." },
      { word: "serve", image: "serve", sentence: "They serve food at the table." },
      { word: "bird", image: "bird", sentence: "A bird is in the sky." },
      { word: "girl", image: "girl", sentence: "The girl plays with her doll." },
      { word: "sir", image: "sir", sentence: "Sir, please sit here." },
      { word: "dirt", image: "dirt", sentence: "There is dirt on my shoe." },
      { word: "curl", image: "curl", sentence: "She has a nice curl in her hair." },
      { word: "fur", image: "fur", sentence: "The cat has soft fur." },
      { word: "curve", image: "curve", sentence: "The road has a sharp curve." },
      { word: "chirp", image: "chirp", sentence: "I hear the birds chirp." },
      { word: "herd", image: "herd", sentence: "A herd of cows is in the field." },
      { word: "hurt", image: "hurt", sentence: "I hurt my knee." },
      { word: "perm", image: "perm", sentence: "She got a perm at the salon." },
      { word: "shirt", image: "shirt", sentence: "He wears a red shirt." },
      { word: "turf", image: "turf", sentence: "We play on the turf." },
      { word: "turn", image: "turn", sentence: "It is your turn now." },
    ],
    exercises: {
      fillBlank: [
        { sentence: "A ___ is in the sky.", answer: "bird", options: ["bird", "herd", "shirt"] },
        { sentence: "The cat has soft ___.", answer: "fur", options: ["fur", "sir", "curl"] },
        { sentence: "The ___ plays with her doll.", answer: "girl", options: ["girl", "curl", "bird"] },
        { sentence: "She has a nice ___ in her hair.", answer: "curl", options: ["curl", "girl", "fern"] },
        { sentence: "___, please sit here.", answer: "sir", options: ["sir", "bird", "fur"] },
      ],
    },
  },
  {
    id: 20,
    title: "Group 20",
    sounds: ["ar"],
    color: "#E74C3C", // Alizarin
    icon: "🚗",
    words: [
      { word: "arm", image: "arm", sentence: "I hurt my arm." },
      { word: "bar", image: "bar", sentence: "He eats a bar of chocolate." },
      { word: "art", image: "art", sentence: "I like to do art at school." },
      { word: "jar", image: "jar", sentence: "She drinks juice from a jar." },
      { word: "car", image: "car", sentence: "Dad drives a car." },
      { word: "ark", image: "ark", sentence: "The animals went into the ark." },
      { word: "dark", image: "dark", sentence: "It is dark at night." },
      { word: "bark", image: "bark", sentence: "Dogs bark at strangers." },
      { word: "card", image: "card", sentence: "I got a birthday card." },
      { word: "park", image: "park", sentence: "We play at the park." },
      { word: "far", image: "far", sentence: "The star is very far." },
      { word: "mark", image: "mark", sentence: "I got a good mark on my test." },
      { word: "shark", image: "shark", sentence: "A shark swims in the sea." },
      { word: "tar", image: "tar", sentence: "The road is made of tar." },
    ],
    exercises: {
      fillBlank: [
        { sentence: "I hurt my ___.", answer: "arm", options: ["arm", "harm", "farm"] },
        { sentence: "Dad drives a ___.", answer: "car", options: ["car", "jar", "bar"] },
        { sentence: "It is ___ at night.", answer: "dark", options: ["dark", "bark", "park"] },
        { sentence: "We play at the ___.", answer: "park", options: ["park", "bark", "dark"] },
        { sentence: "Dogs ___ at strangers.", answer: "bark", options: ["bark", "park", "dark"] },
      ],
    },
  },
];

// Auto-generate words for groups 1-13 from sounds-pics images.
// Images are the source of truth — adding/removing a pic auto-updates the word list.
// Existing sentence data is preserved; new words get a simple default sentence.
const AUTO_GEN_GROUPS = 20; // groups 1 through 20

PHONICS_GROUPS.forEach((group) => {
  if (group.id > AUTO_GEN_GROUPS) return;

  const imageWords = getGroupWordNames(group.id);
  if (imageWords.length === 0) return;

  // Build a lookup of existing word data (sentences, etc.) by word name
  const existingData = {};
  group.words.forEach((w) => {
    existingData[w.word.toLowerCase()] = w;
  });

  // Rebuild words array from images, preserving existing sentence data
  group.words = imageWords.map((wordName) => {
    const existing = existingData[wordName];
    if (existing) return existing;
    // New word from image — generate a minimal entry
    const capitalized = wordName.charAt(0).toUpperCase() + wordName.slice(1);
    return {
      word: wordName,
      image: wordName,
      sentence: `I see a ${wordName}.`,
    };
  });
});

// Auto-generate sentence data for ALL groups from sentences-pics images.
// Sentence pic filenames ARE the sentence text (e.g. "He is a tall man.webp").
// If a group has no sentence-pics folder yet, it keeps its hardcoded sentences.
// When pics are added, the app will auto-pick them up on next build.
PHONICS_GROUPS.forEach((group) => {
  const sentencePics = getGroupSentencePics(group.id);
  if (sentencePics.length === 0) return;

  // Match sentence pics to words by finding which group word appears in the sentence
  group.words.forEach((w) => {
    const wordLower = w.word.toLowerCase();
    // Escape regex special chars in word
    const escaped = wordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = sentencePics.find((sp) =>
      new RegExp(`\\b${escaped}\\b`, 'i').test(sp.sentence)
    );
    if (match) {
      // Update sentence to match the pic filename, add period if no ending punctuation
      let sentence = match.sentence;
      if (!/[.!?]$/.test(sentence)) sentence += '.';
      w.sentence = sentence;
    }
  });
});

// Letter paths for tracing (SVG path data for each letter)
export const LETTER_PATHS = {
  a: "M50 150 Q100 50 150 150 M50 100 H150",
  b: "M50 50 V150 M50 50 Q100 50 100 100 Q100 150 50 150",
  c: "M150 75 Q100 50 75 75 Q50 100 75 125 Q100 150 150 125",
  d: "M150 50 V150 M150 50 Q100 50 100 100 Q100 150 150 150",
  e: "M50 100 H150 M150 75 Q100 50 75 75 Q50 100 75 125 Q100 150 150 125",
  f: "M100 50 Q75 50 75 75 V150 M50 100 H125",
  g: "M150 75 Q100 50 75 75 Q50 100 75 125 Q100 150 150 125 V175 Q150 200 100 200",
  h: "M50 50 V150 M50 100 Q100 75 150 100 V150",
  i: "M100 75 V150 M100 50 A5 5 0 1 0 100 60",
  j: "M125 75 V175 Q125 200 75 200 M125 50 A5 5 0 1 0 125 60",
  k: "M50 50 V150 M50 100 L150 50 M50 100 L150 150",
  l: "M75 50 V150 H125",
  m: "M50 150 V75 L100 125 L150 75 V150",
  n: "M50 150 V75 Q100 50 150 75 V150",
  o: "M100 50 Q50 50 50 100 Q50 150 100 150 Q150 150 150 100 Q150 50 100 50",
  p: "M50 75 V200 M50 75 Q100 50 100 100 Q100 150 50 150",
  q: "M150 75 V200 M150 75 Q100 50 100 100 Q100 150 150 150",
  r: "M50 75 V150 M50 100 Q100 75 100 75",
  s: "M125 75 Q100 50 75 75 Q50 85 75 100 Q125 115 125 125 Q125 150 75 150",
  t: "M100 50 V150 M75 75 H125",
  u: "M50 75 V125 Q50 150 100 150 Q150 150 150 125 V75",
  v: "M50 75 L100 150 L150 75",
  w: "M50 75 L75 150 L100 100 L125 150 L150 75",
  x: "M50 75 L150 150 M150 75 L50 150",
  y: "M50 75 L100 125 M150 75 L100 125 V200",
  z: "M50 75 H150 L50 150 H150",
};

// Game types available
export const GAME_TYPES = {
  TRACE_LETTER: 'trace_letter',
  WORD_MATCH: 'word_match',
  FILL_BLANK: 'fill_blank',
  SOUND_IDENTIFY: 'sound_identify',
  PICTURE_SPELL: 'picture_spell',
  MEMORY_CARDS: 'memory_cards',
  WORD_BUILD: 'word_build',
  SENTENCE_READ: 'sentence_read',
};

export default PHONICS_GROUPS;
// Backwards-compatible export used by existing screens.
export const phonicsGroups = PHONICS_GROUPS;

// Level 2 placeholder groups (locked for now). You can replace with real data later.
export const LEVEL2_GROUPS = Array.from({ length: 12 }).map((_, i) => ({
  id: 100 + i + 1,
  title: `Level 2 - Group ${i + 1}`,
  sounds: [],
  color: '#64748B',
  icon: '🔒',
  words: [],
  exercises: { fillBlank: [] },
  locked: true,
}));
