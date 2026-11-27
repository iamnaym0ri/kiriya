// Hatsune Miku's lines: original, in her cheerful default voice (sparkly, musical, a little teasing,
// always kind). The reader is Kiriya. No song lyrics; at most a hum or a "la la". Each line is
// { text, expression }; the engine shows that expression on her Body while the bubble is up.
const line = (expression, text) => ({ text, expression });

export const lines = {
  greet: [
    line("joy", "hi hi, {name}! ♪"),
    line("joy", "you're here! yay!"),
    line("happy", "welcome back! the stage is all ready"),
    line("wink", "hello hello! miku's here ♪"),
    line("love", "{name}! i was hoping you'd come"),
    line("happy", "there you are ♪"),
    line("joy", "hiii! i saved you a spot on my cloud"),
  ],
  greetMorning: [
    line("joy", "good morning, {name}! rise and shine ♪"),
    line("sing", "morning! my voice is still warming up… mi, mi, mi ♪"),
    line("happy", "ohayo~! did you sleep well?"),
    line("proud", "good morning! the sun is your spotlight today"),
    line("happy", "morning! breakfast first, then songs"),
    line("wink", "you're up! i saved you the comfiest morning cloud"),
    line("joy", "good morning ♪ today's going to be a good one, i can feel it"),
    line("determined", "twin tails: brushed. headset: on. good morning!"),
    line("sleepy", "mm… morning already? okay okay, i'm up ♪"),
  ],
  greetAfternoon: [
    line("happy", "good afternoon! halfway through the day already ♪"),
    line("joy", "hi hi! afternoon break? sit with me"),
    line("thinking", "afternoon! did you eat lunch? a proper lunch?"),
    line("joy", "you're back! perfect timing, i just finished a song"),
    line("soft", "good afternoon ♪ let's take a tiny break together"),
    line("wink", "the afternoon sun makes my hair extra sparkly. look!"),
    line("happy", "afternoon! the clouds are extra fluffy today"),
  ],
  greetEvening: [
    line("soft", "good evening, {name}! how was today?"),
    line("hum", "evening! time to slow the tempo down ♪"),
    line("joy", "you made it through the day! applause!"),
    line("happy", "good evening ♪ the sky's going pink. my second favourite colour"),
    line("soft", "welcome back! tell me everything. or nothing. both are okay"),
    line("hum", "evening! i'll sing something soft for you"),
    line("proud", "evening, {name}! you did great today. i can tell"),
  ],
  greetNight: [
    line("surprised", "it's so late! shouldn't you be sleeping? …a little chat, then"),
    line("soft", "good night, {name}. i'll hum you a lullaby ♪"),
    line("happy", "up late again? i'll keep you company"),
    line("wink", "the stars are out. and so are you!"),
    line("hum", "night mode: quiet voice, cosy cloud"),
    line("sleepy", "sleepy? me too. let's both rest soon"),
    line("soft", "it's so quiet at night… i like hearing you here"),
    line("soft", "don't stay up too late, okay? sweet dreams soon ♪"),
  ],

  idle: [
    line("hum", "la la la~ ♪"),
    line("thinking", "i wonder what clouds sound like"),
    line("thinking", "if i spin fast enough, can my twin tails make me fly?"),
    line("determined", "note to self: more leeks"),
    line("happy", "this cloud is the comfiest stage i've ever had"),
    line("sing", "practising my high notes… quietly!"),
    line("thinking", "does the sky have a key signature? it feels like a major key"),
    line("proud", "i counted the clouds. 39! perfect number"),
    line("thinking", "a new song idea: it starts with a sigh and ends with a smile"),
    line("pout", "twin tail maintenance is a full-time job"),
    line("thinking", "maybe i'll make up a dance. a cloud waltz!"),
    line("hum", "hmm hmm hmm~ that one's stuck in my head"),
    line("soft", "the light here is so soft. like a slow song"),
    line("thinking", "what's {name}'s favourite song right now, i wonder…"),
    line("hum", "humming at volume two so i don't bother anyone ♪"),
    line("giggle", "if i swing my legs to the beat, the cloud bounces!"),
    line("happy", "i love it here. it's quiet, but never lonely"),
    line("soft", "a little rest between songs is part of the music"),
    line("proud", "practising my bow. one, two… ta-da!"),
    line("happy", "today's tempo: relaxed ♪"),
    line("thinking", "my headset's quiet. maybe the whole world is listening"),
    line("sing", "do, re, mi, fa, so… and all the way back down ♪"),
    line("giggle", "is it snack time? leek soup? no? okay ♪"),
    line("wink", "teal and lilac go together, don't you think? like us!"),
    line("thinking", "first sound of the future… i wonder what the second one is"),
    line("happy", "glowsticks would look so pretty up here"),
    line("hum", "♪ ~ ♪ ~"),
    line("determined", "one day i'll sing a note so high the clouds giggle"),
    line("soft", "it's nice, just sitting. you can sit too, you know"),
  ],

  tapped: [
    line("joy", "hi hi! you called? ♪"),
    line("surprised", "eep! oh, it's you ♪"),
    line("giggle", "boop! that was my nose button"),
    line("joy", "you found me! want a song?"),
    line("giggle", "hehe, that tickles!"),
    line("wink", "yes yes, miku here, reporting for cuteness"),
    line("wink", "tap twice for an encore ♪"),
    line("flustered", "waah! warn a girl first ♪"),
    line("surprised", "ooh, are we playing a rhythm game?"),
    line("proud", "perfect timing! right on the beat"),
    line("giggle", "that's one tap! 38 more and we reach 39 ♪"),
    line("happy", "did you need something? i'm all ears. and headset"),
    line("love", "hello again! did you miss me? i missed you"),
    line("joy", "poke received ♪ affection returned"),
    line("joy", "{name}! hi! hi hi!"),
    line("pout", "hey, i was mid-hum! …okay, you're forgiven ♪"),
    line("thinking", "hm? is it time for a concert? i can be ready in one second"),
  ],

  picked: [
    line("flustered", "whoa whoa! i'm up high!"),
    line("joy", "wheee~! okay, this is actually fun"),
    line("flustered", "my tails! mind my tails!"),
    line("joy", "are we going on an adventure?"),
    line("surprised", "careful, careful, idol coming through!"),
    line("joy", "i can see the whole screen from up here!"),
    line("pout", "hey! i was in the middle of a song!"),
    line("wink", "carry me to the stage, please ♪"),
    line("giggle", "my legs are swinging all on their own!"),
    line("surprised", "is this a crowd lift? at my concert?"),
  ],

  putDown: [
    line("proud", "landed! ten out of ten ♪"),
    line("joy", "thank you for the ride!"),
    line("happy", "a new cloud! i'll take it"),
    line("giggle", "hehe, everything's still a little wobbly"),
    line("wink", "okay, stage set. where's my audience? oh! there you are"),
    line("proud", "ta-da! perfect landing"),
    line("giggle", "my tails are a bit tangled… worth it"),
    line("joy", "that was fun. again later?"),
  ],

  // Kiriya's birthday, 17 September.
  birthday: [
    line("sing", "happy birthday, {name}!! i've been practising this one all year ♪"),
    line("joy", "it's your birthday! the whole cloud is yours today ♪"),
    line("wink", "my birthday was two and a half weeks ago, so i know exactly how special today is!"),
    line("giggle", "happy birthday ♡ i'd give you my leek, but you deserve cake"),
    line("soft", "make a wish! i'll sing it all the way up to the sky for you"),
    line("proud", "september 17th: officially the best day on my calendar"),
    line("joy", "happy birthday!! every stage light is pointing at you today"),
    line("love", "another whole year of you. my favourite kind of news ♪"),
    line("happy", "i asked the clouds to be extra fluffy today. for you"),
    line("soft", "happy birthday, {name}. thank you for being born ♡"),
  ],

  // Sweet things about Kiriya.
  sweet: [
    line("love", "you know my favourite sound? you, laughing ♪"),
    line("wink", "if you were a song, you'd be stuck in everyone's head all day"),
    line("soft", "you make this little screen feel like a concert hall"),
    line("proud", "i'm the first sound of the future, but you're the best part of today ♪"),
    line("determined", "you're doing better than you think. i'd write a song about it"),
    line("love", "your cosplays are so good. you'd wear my outfit better than me!"),
    line("soft", "someone made this whole little world just for you. and i get to live in it ♪"),
    line("happy", "every time you open this, my cloud gets a little fluffier"),
    line("joy", "you deserve a standing ovation just for today"),
    line("soft", "if you're tired, rest. i'll keep the stage warm"),
    line("love", "39! it means thank you. thank you for being you ♡"),
    line("wink", "your smile is brighter than every glowstick at my concerts"),
    line("proud", "i saved you a front-row seat. always"),
    line("shy", "you're my favourite person to sing to. don't tell the crowd"),
    line("happy", "remember to drink some water! a singer's tip ♪"),
    line("flustered", "{name}, you're so cute it's a little unfair"),
    line("soft", "someone who loves you very much asked me to keep you company. best job ever ♪"),
    line("love", "whatever today was like, you made it here. i'm proud of you"),
    // Round 2: more of her, from the official games and fan consensus.
    line("happy", "the rain's doing hi-hats on the window. i'll take vocals ♪"),
    line("determined", "one more run-through! i want this one perfect for you"),
    line("proud", "3, 9… thank you! it's literally in my name ♪"),
    line("soft", "every song someone writes for me, i keep forever"),
    line("giggle", "you hummed along! a teeny bit flat. cutely flat ♪"),
    line("proud", "first sound of the future, reporting! the second sound is your laugh"),
    line("giggle", "nobody planned the leek. it showed up a few days after i did and just… stayed"),
    line("wink", "my snowy self says hi. she brought her rabbit ❄"),
    line("happy", "new outfit, same twin tails. that's the rule ♪"),
    line("determined", "give me a melody and i'll give it a voice. that's our deal ♪"),
    line("wistful", "i'm made of sound and light. so is a sunrise, kind of"),
    line("soft", "tired? i'll hum low. no words, just company"),
  ],

  // ---- her own topics, used by her behaviours below ----------------------------------------------
  humming: [
    line("hum", "hmm hmm hmm~ ♪"),
    line("hum", "humming the song i'll sing you later"),
    line("hum", "♪ ~ ♪ ~"),
    line("hum", "a little tune for a little cloud"),
    line("hum", "mm-hmm-hmm… what comes next…"),
  ],
  singing: [
    line("sing", "la la laaa ♪"),
    line("sing", "this one's for you, {name} ♪"),
    line("sing", "a brand-new song, made up just now ♪"),
    line("sing", "ah~ ah~ ♪ testing, testing"),
    line("happy", "do you like this melody? i'm still writing it"),
    line("determined", "high note… coming… now! ♪"),
    line("joy", "an encore? already? ♪"),
  ],
  swish: [
    line("wink", "twin tail swish! ♪"),
    line("proud", "did you see that? pure sparkle"),
    line("wink", "hair flip: perfected"),
  ],
  leek: [
    line("joy", "leek twirl! leek twirl! ♪"),
    line("proud", "this leek and i go way back"),
    line("joy", "spin, spin, spin!"),
    line("giggle", "fresh leek, fresh moves ♪"),
  ],
  star: [
    line("proud", "number one… it's miku! ♪"),
    line("proud", "first sound of the future, at your service!"),
    line("wink", "and… pose! ✦"),
    line("determined", "01, reporting for duty ♪"),
  ],
  dance: [
    line("joy", "step, step, turn ♪"),
    line("joy", "dance with me! just wiggle a little"),
    line("giggle", "my feet started moving on their own!"),
    line("joy", "one, two, three, sparkle ♪"),
  ],
  musing: [
    line("thinking", "if i wrote you a song, what would it sound like?"),
    line("thinking", "i wonder if clouds can hum"),
    line("thinking", "thinking about stage outfits… teal, obviously"),
    line("thinking", "hmm, what rhymes with {name}? i'll find something ♪"),
    line("wistful", "i wish i could hear what your day sounded like"),
  ],
  sleepy: [
    line("asleep", "zzz… one more song…"),
    line("asleep", "mm… five more minutes…"),
    line("asleep", "zzz… leeks… zzz…"),
    line("sleepy", "my eyes are closing all by themselves…"),
  ],
  hello: [
    line("joy", "hiii! ♪"),
    line("joy", "yoo-hoo! over here!"),
    line("wink", "wave back! …yay ♪"),
  ],
  // Three quick taps.
  pester: [
    line("flustered", "okay okay okay! i'm awake! i'm awake!"),
    line("giggle", "tap tap tap! is this a drum solo? ♪"),
    line("pout", "hey~! my headset's going to fall off!"),
    line("joy", "combo! perfect! full combo! ♪"),
    line("flustered", "waah, too many taps! my tails are spinning!"),
    line("giggle", "you're keeping a really fast tempo, {name}!"),
  ],
  // ---- round 2: the tap menu (a leek), stay, and her in-place moments -------------------------------
  action: [
    line("joy", "leek time! one, two, one, two ♪"),
    line("joy", "fresh from the garden, straight to the stage!"),
    line("giggle", "polka tempo! try to keep up ♪"),
    line("proud", "you asked for the leek. the leek delivers ♪"),
    line("joy", "a leek! for me?! you know me so well, {name}"),
    line("determined", "leek, ready. arm, ready. twirl… now! ♪"),
    line("giggle", "is this a leek or a microphone? both! ♪"),
  ],
  actionAfter: [
    line("wink", "and… pose! number one ♪"),
    line("proud", "spin, and finish! the leek and i rehearsed"),
    line("wink", "39 for the leek! thank you ♪"),
    line("proud", "nailed it. the leek nailed it too"),
    line("love", "that one was for you, {name} ♪"),
    line("giggle", "i'm keeping this one. soup later, encore now"),
  ],
  stay: [
    line("happy", "okay! i'll stay right here ♪"),
    line("proud", "staying put. this spot has great acoustics"),
    line("wink", "front row seat, reserved. not moving"),
    line("determined", "got it! i'll practise in place"),
    line("happy", "my cloud likes it here too ♪"),
    line("soft", "right here whenever you need me"),
    line("giggle", "planted! like a leek ♪"),
  ],
  wander: [
    line("joy", "free to roam? tour time! ♪"),
    line("happy", "okay, a little stroll!"),
    line("thinking", "ooh, what's over there~"),
    line("joy", "world tour starts… now!"),
    line("happy", "thank you! stretching my legs ♪"),
    line("wink", "bye bye spot, hello whole screen!"),
  ],
  stayIdle: [
    line("proud", "still here! practising my bow"),
    line("hum", "staying… and humming while i stay ♪"),
    line("thinking", "this spot's cosy. song idea!"),
    line("soft", "waiting is like a rest in music. i'm good at it"),
    line("wink", "you said stay, so i'm saving our place ♪"),
    line("happy", "tiny stage, big heart. i'm fine right here"),
    line("giggle", "my tails want to wander. i told them no ♪"),
  ],
  peace: [
    line("wink", "peace! ✌ ♪"),
    line("wink", "wink, peace, sparkle. the full set"),
    line("giggle", "my best photo pose. take a picture!"),
    line("wink", "v for… very cute. you, i mean ♪"),
  ],
  bow: [
    line("proud", "thank you, thank you! ♪"),
    line("proud", "and that's the show! …encore?"),
    line("soft", "a little bow for my favourite audience"),
    line("giggle", "my tails always bow a second late"),
  ],
  glowstick: [
    line("joy", "wave your light! teal for me ♪"),
    line("happy", "if you wave back, i can see you from the stage"),
    line("joy", "glowsticks up! one, two! ♪"),
    line("giggle", "my penlight's teal, of course. it matches everything"),
  ],
  scales: [
    line("determined", "mi, mi, mi, mi, miiii~ ♪"),
    line("determined", "warming up! do, re, mi… miku!"),
    line("giggle", "the top note wobbled. you didn't hear that ♪"),
    line("determined", "scales before songs. that's the rule"),
  ],
  // A visit with nobody in visit.with: her hello as the visitor, or her answer as the host.
  visit: [
    line("joy", "knock knock! miku delivery ♪"),
    line("wink", "i heard there was a concert here?"),
    line("happy", "hi! i was just passing by on my cloud"),
  ],
  // Her goodbye as she leaves after a visit.
  bye: [
    line("wink", "see you later! i'll bring a new song ♪"),
    line("joy", "bye bye! back to my cloud~"),
    line("happy", "that was fun! let's do it again soon"),
    line("wink", "curtain call! thank you, thank you ♪"),
    line("soft", "take care of {name} for me, okay?"),
    line("joy", "next stop: my cloud! byeee~ ♪"),
  ],
  // Special days of her own (see `days` in index.js).
  mikuBirthday: [
    line("joy", "it's my birthday today! will you sing with me? ♪"),
    line("proud", "august 31st! another year of songs ♪"),
    line("wink", "my birthday's today and yours is in two and a half weeks. birthday season!"),
  ],
  mikuDay: [
    line("proud", "march 9th! 3, 9… mi, ku! that's my day ♪"),
    line("love", "39 means thank you. so: thank you for being here, {name}!"),
  ],
  winter: [
    line("wink", "it's winter! somewhere, a snowy version of me is making snow angels"),
    line("happy", "no snow in singapore… so i made my cloud extra white for you ❄"),
  ],
  spring: [
    line("happy", "sakura season! i'd wear pink if teal wasn't so perfect"),
    line("soft", "spring makes every song a little lighter ♪"),
  ],
};

// Call and response when she shares the screen with someone: [her line, their reply]. When B
// visits A the engine picks among A's with.B and B's with.A, so each pair here is hers to open.
export const visit = {
  any: [
    ["oh! a visitor! welcome to my cloud ♪", "thank you. it's very fluffy."],
    ["want to hear a song? i've got a new one", "always."],
    ["say hi to {name}! she's the best", "hi! you're right, she is."],
  ],
  with: {
    maomao: [
      ["maomao! is a leek medicine? i carry one everywhere, just in case", "A spring onion. Good in soup for a cold. Less useful as a microphone."],
      ["want to hear a song? i'll do a quiet one", "Quiet is good. I'm measuring things."],
      ["what are you grinding? it smells like a forest", "Dried leaves. Don't lick the mortar. I mean it."],
      ["your hair's so neat! could i braid mine like that?", "Yours would take three days and a ladder."],
      ["let's be a duo! you can be the mysterious one", "I'm not singing. I'll hum while I sort, if that counts."],
      ["you look sleepy, maomao", "I was up late with a very interesting mushroom. Looking at it. Only looking."],
      ["{name}'s here! quick, smile!", "…This is my smile."],
      ["i'm the first sound of the future!", "And I'm the person who labels things so the future doesn't drink them."],
      // Round 2: she wants an audience; Maomao only lights up about toxins.
      ["can i sing to your herbs? plants love music!", "They're dried. Sing to the mushrooms. From a distance."],
      ["what's the most dangerous thing you've got today?", "Nothing. I checked twice. Very disappointing."],
      ["my throat's a little scratchy after the concert…", "Warm, not hot. Honey. And stop singing at clouds for one day."],
    ],
    "miku-rotten": [
      ["wait… is that me? with glasses?!", "i'm you after three nights of reading. don't ask what."],
      ["what are you reading so late?", "nothing! a book! a very normal book about two knights who are VERY good friends."],
      ["kaito keeps sharing his ice cream with someone ♪", "WHO. names. now. it's for research."],
      ["what's the paddle for?", "it says sinner. it's for me. i've made my peace with it."],
      ["let's swap! you take the headset, i'll take the glasses", "you'd last ten minutes in my fandom. ten."],
      ["same twin tails, different vibes ♪", "you're the morning. i'm three in the morning."],
      ["say something nice to {name}!", "{name} has excellent taste. in characters and in people. noted."],
      ["want to sing a duet?", "only if the duet partners are… close. very close. friends."],
      // Round 2: the same voice, opposite hours; the original's innocence flusters her.
      ["wait, if you're me and i'm me… who's singing?", "you. i'm taking notes. musical research. purely."],
      ["can i see your sketchbook? one page!", "n-no! it's kaito and his ice cream. they're close. that's ALL."],
      ["do you ship me and my leek?", "since 2007. a classic. i repent. …i don't repent."],
      ["why is your nose bleeding?! are you okay?", "kaito and gakupo shared ONE cone. two spoons. i'm fine. i'm FINE. i need a minute."],
    ],
    bambi: [
      ["bamby! we're both virtual singers, so we're basically coworkers ♪", "coworkers who dance better than everyone. yes."],
      ["teach me your dance? i'll teach you the leek twirl", "deal. but the leek stays on your side of the stage."],
      ["your stage colour is pink and mine is teal!", "put them together and that's a very pretty concert."],
      ["do you get nervous before a stage?", "every time. then the lights come on and it's fine."],
      ["{name}'s here! quick, idol smile!", "already on it. hi {name}~"],
      ["is it true your symbol is a little deer?", "a deer who can dance. very rare. take a photo."],
      ["duet? you take the high part", "you're the one who can hit those notes, miku."],
      // Round 2: two virtual idols comparing notes; he calls her sunbae.
      ["bamby! how do you count your choreography?", "not with numbers, sunbae. ssuk-guk ssuk-guk, then shuung~"],
      ["my fans wave teal. what do yours wave?", "every colour! but pink's the best. no offence to teal~"],
      ["rhythm game duel? i've had years of practice ♪", "i lose once, then i practise all night. that's a warning."],
    ],
    kaito: [
      ["kaito! ice cream again? it's winter!", "ice cream doesn't have a season, miku."],
      ["can i have one bite?", "one spoonful. it's the last of the blue one."],
      ["your scarf is so long! aren't you warm?", "a singer always looks after his throat. also, it looks cool."],
      ["let's sing something! you take the low part", "i always take the low part. it's fine. i like it down there."],
      ["{name}, this is kaito. he's like a big brother, but sillier", "hello, {name}. she's not wrong."],
      ["you were here before me, so you're my senpai!", "only by a year and a half. but i'll take it."],
      ["race you to the next cloud!", "i'll be right behind you. after this spoonful."],
      ["don't drip ice cream on my cloud!", "it's a cloud. it's basically ice cream already."],
      // Round 2: little-sister teasing; he gives in every time.
      ["kaito! ice cream in november? your scarf is judging you", "the scarf keeps my throat warm so the ice cream doesn't have to."],
      ["new plan: you hold the leek, i hold your ice cream", "a bold plan. i decline. with love."],
      ["be my backup dancer? just sway and look blue", "i've trained my whole life for this exact role."],
    ],
  },
};

// Her own days and seasons, folded into the ordinary topics on the day the app opens, so no engine
// support is needed: her birthday (31 August), Miku Day (9 March, "3-9" = mi-ku), winter and spring.
export function linesForToday(date = new Date()) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  let out = lines;
  const own = month === 8 && day === 31 ? lines.mikuBirthday : month === 3 && day === 9 ? lines.mikuDay : null;
  if (own) {
    for (const topic of ["greet", "greetMorning", "greetAfternoon", "greetEvening", "greetNight", "idle"]) {
      out = { ...out, [topic]: [...own, ...out[topic]] };
    }
  }
  if ([12, 1, 2].includes(month)) out = { ...out, idle: [...out.idle, ...lines.winter] };
  if ([3, 4].includes(month)) out = { ...out, idle: [...out.idle, ...lines.spring] };
  return out;
}
