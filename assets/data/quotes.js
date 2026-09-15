/* Quotes shown in the hero. Two flavours:
   - "forces": Indian armed forces, war heroes, regimental war cries, service mottos
   - "motivation": high-energy motivational lines (incl. freedom fighters, Kalam)
   Kept as a plain global so the site also works when opened from file://
*/
window.SHAURYA_QUOTES = [
  // ---------- Armed forces ----------
  {
    text: "Quartered in snow, silent to remain. When the bugle calls, they shall rise and march again.",
    author: "Siachen Base Camp memorial",
    kind: "forces",
  },

  /* ---------- Women in uniform ----------
     Written as recorded milestones rather than invented quotations: these are
     verifiable firsts, so nothing is put in anyone's mouth. Swap in sourced
     verbatim lines if you have them. */
  {
    text: "Punita Arora rose to Lieutenant General — the first woman in India to wear three stars.",
    author: "Lt Gen Punita Arora, VSM, SM",
    kind: "forces",
  },
  {
    text: "Gunjan Saxena flew casualty evacuation into the Kargil heights under fire, in 1999.",
    author: "Flt Lt Gunjan Saxena — the Kargil Girl",
    kind: "forces",
  },
  {
    text: "In 2018 Avani Chaturvedi took a MiG-21 up alone — India's first woman to fly a fighter solo.",
    author: "Flt Lt Avani Chaturvedi, Indian Air Force",
    kind: "forces",
  },
  {
    text: "Shivangi Singh flies the Rafale — the first Indian woman on the type.",
    author: "Sqn Ldr Shivangi Singh, Indian Air Force",
    kind: "forces",
  },
  {
    text: "Tania Shergill marched at the head of the Republic Day parade — its first woman adjutant.",
    author: "Capt Tania Shergill, Corps of Signals, 2020",
    kind: "forces",
  },
  {
    text: "Bharat ki betiyan — the daughters of India fly her fighters, sail her warships and command her men.",
    author: "Women of the Indian Armed Forces",
    kind: "forces",
  },
  {
    text: "If a man says he is not afraid of dying, he is either lying or is a Gorkha.",
    author: "Field Marshal Sam Manekshaw",
    kind: "forces",
  },
  {
    text: "I will either come back after raising the Indian flag in victory, or return wrapped in it. But I will be back for sure.",
    author: "Captain Vikram Batra, PVC",
    kind: "forces",
  },
  {
    text: "Yeh Dil Maange More!",
    author: "Captain Vikram Batra, PVC — Kargil, 1999",
    kind: "forces",
  },
  {
    text: "The safety, honour and welfare of your country come first, always and every time.",
    author: "The Chetwode Motto, Indian Military Academy",
    kind: "forces",
  },
  {
    text: "The honour, welfare and comfort of the men you command come next. Your own ease, comfort and safety come last, always and every time.",
    author: "The Chetwode Motto, Indian Military Academy",
    kind: "forces",
  },
  {
    text: "The enemy is only fifty yards from us. We are heavily outnumbered. But I shall not withdraw an inch — we will fight to our last man and our last round.",
    author: "Major Somnath Sharma, PVC — Badgam, 1947",
    kind: "forces",
  },
  {
    text: "If death strikes before I prove my blood, I swear I will kill death.",
    author: "Captain Manoj Kumar Pandey, PVC",
    kind: "forces",
  },
  {
    text: "Some goals are so worthy, it is glorious even to fail.",
    author: "Captain Manoj Kumar Pandey, PVC",
    kind: "forces",
  },
  {
    text: "There will be no withdrawal without written orders, and these orders shall never be issued.",
    author: "Field Marshal Sam Manekshaw",
    kind: "forces",
  },
  {
    text: "Naam, Namak, Nishan — the name of your unit, loyalty to the salt you eat, and the colours you serve under.",
    author: "Indian Army ethos",
    kind: "forces",
  },
  {
    text: "Veer Bhogya Vasundhara — the brave shall inherit the earth.",
    author: "Sanskrit maxim carried by Indian regiments",
    kind: "forces",
  },
  {
    text: "Nabha Sparsham Deeptam — touch the sky with glory.",
    author: "Motto of the Indian Air Force",
    kind: "forces",
  },
  {
    text: "Sham No Varunah — may the Lord of the Oceans be auspicious unto us.",
    author: "Motto of the Indian Navy",
    kind: "forces",
  },
  {
    text: "Service Before Self.",
    author: "Motto of the Indian Army",
    kind: "forces",
  },
  {
    text: "Balidan — sacrifice.",
    author: "War cry of the Parachute Regiment (Special Forces)",
    kind: "forces",
  },
  {
    text: "Jai Mahakali, Ayo Gorkhali — glory to Great Kali, the Gorkhas are here!",
    author: "War cry of the Gorkha Rifles",
    kind: "forces",
  },
  {
    text: "Jo Bole So Nihal, Sat Sri Akal!",
    author: "War cry of the Sikh Regiment",
    kind: "forces",
  },
  {
    text: "Bol Shri Chhatrapati Shivaji Maharaj ki Jai!",
    author: "War cry of the Maratha Light Infantry",
    kind: "forces",
  },
  {
    text: "Badri Vishal Lal ki Jai!",
    author: "War cry of the Garhwal Rifles",
    kind: "forces",
  },
  {
    text: "Jat Balwan, Jai Bhagwan!",
    author: "War cry of the Jat Regiment",
    kind: "forces",
  },
  {
    text: "Sarvada Shaktishali — ever powerful.",
    author: "Motto of The Grenadiers",
    kind: "forces",
  },
  {
    text: "Veer Madrassi, Adi Kollu, Adi Kollu!",
    author: "War cry of the Madras Regiment",
    kind: "forces",
  },
  {
    text: "Kalika Mata ki Jai!",
    author: "War cry of the Kumaon Regiment",
    kind: "forces",
  },
  {
    text: "Jwala Mata ki Jai!",
    author: "War cry of the Dogra Regiment",
    kind: "forces",
  },
  {
    text: "The bravest are surely those who have the clearest vision of what is before them, glory and danger alike, and yet notwithstanding go out to meet it.",
    author: "Thucydides — inscribed at Indian war memorials",
    kind: "forces",
  },
  {
    text: "When you go home, tell them of us and say: for your tomorrow, we gave our today.",
    author: "Kohima Epitaph, Kohima War Cemetery",
    kind: "forces",
  },
  {
    text: "A soldier does not fight because he hates what is in front of him. He fights because he loves what is behind him.",
    author: "Soldier's creed",
    kind: "forces",
  },
  {
    text: "We fight to win, and win with a knockout, because there are no runners-up in war.",
    author: "Field Marshal Sam Manekshaw",
    kind: "forces",
  },
  {
    text: "Discipline is not a punishment. It is the shortest road to victory.",
    author: "Indian Army training maxim",
    kind: "forces",
  },

  // ---------- Motivation & freedom fighters ----------
  {
    text: "Tum mujhe khoon do, main tumhe azadi dunga — give me blood, and I will give you freedom!",
    author: "Netaji Subhas Chandra Bose",
    kind: "motivation",
  },
  {
    text: "Chalo Delhi! Jai Hind!",
    author: "Netaji Subhas Chandra Bose",
    kind: "motivation",
  },
  {
    text: "They may kill me, but they cannot kill my ideas. They can crush my body, but they will not be able to crush my spirit.",
    author: "Shaheed Bhagat Singh",
    kind: "motivation",
  },
  {
    text: "Inquilab Zindabad — long live the revolution!",
    author: "Shaheed Bhagat Singh",
    kind: "motivation",
  },
  {
    text: "Dushman ki goliyon ka hum samna karenge. Azad hi rahe hain, azad hi rahenge.",
    author: "Chandra Shekhar Azad",
    kind: "motivation",
  },
  {
    text: "Swaraj is my birthright, and I shall have it.",
    author: "Bal Gangadhar Tilak",
    kind: "motivation",
  },
  {
    text: "Jai Jawan, Jai Kisan.",
    author: "Lal Bahadur Shastri",
    kind: "motivation",
  },
  {
    text: "Arise, awake, and stop not till the goal is reached.",
    author: "Swami Vivekananda",
    kind: "motivation",
  },
  {
    text: "Dream, dream, dream. Dreams transform into thoughts, and thoughts result in action.",
    author: "Dr. A. P. J. Abdul Kalam",
    kind: "motivation",
  },
  {
    text: "If you want to shine like the sun, first learn to burn like the sun.",
    author: "Dr. A. P. J. Abdul Kalam",
    kind: "motivation",
  },
  {
    text: "Let us sacrifice our today so that our children can have a better tomorrow.",
    author: "Dr. A. P. J. Abdul Kalam",
    kind: "motivation",
  },
  {
    text: "Man needs difficulties in life, because they are necessary to enjoy success.",
    author: "Dr. A. P. J. Abdul Kalam",
    kind: "motivation",
  },
  {
    text: "Excellence is a continuous process, not an accident.",
    author: "Dr. A. P. J. Abdul Kalam",
    kind: "motivation",
  },
  {
    text: "Strength does not come from physical capacity. It comes from an indomitable will.",
    author: "Mahatma Gandhi",
    kind: "motivation",
  },
  {
    text: "Main apni Jhansi nahi doongi — I shall not surrender my Jhansi.",
    author: "Rani Lakshmibai of Jhansi",
    kind: "motivation",
  },
  {
    text: "It is better to live like a lion for a day than to live like a jackal for a hundred years.",
    author: "Rani Lakshmibai of Jhansi",
    kind: "motivation",
  },
  {
    text: "Sarfaroshi ki tamanna ab hamare dil mein hai, dekhna hai zor kitna baazu-e-qaatil mein hai.",
    author: "Bismil Azimabadi — anthem of the freedom struggle",
    kind: "motivation",
  },
  {
    text: "Push yourself, because no one else is going to do it for you.",
    author: "Training ground truth",
    kind: "motivation",
  },
  {
    text: "The pain you feel today is the strength you feel tomorrow.",
    author: "Soldier's maxim",
    kind: "motivation",
  },
  {
    text: "Hard times create strong men. Strong men create good times.",
    author: "Warrior's proverb",
    kind: "motivation",
  },
];
