export const mockJapaneseUnit = {
    unitId: "ja-u1",
    unitTitle: "Japanese",
    nodes: [
        {
            id: "ja-n1",
            title: "Greetings & Introductions",
            description: "Practice common greetings, introductions and formality.",
            type: "exercise",
            status: "available",
            stages: [
                {
                    stageId: "ja-s1",
                    topic: "Match Greeting to Context",
                    module: "Practice",
                    component: "TaxonomyMatrix",
                    skin: "Classic",
                    config: {
                        data: {
                            buckets: ["Morning", "Evening", "Formal", "Casual"],
                            items: [
                                { id: "g1", content: "おはよう (Ohayou)" },
                                { id: "g2", content: "こんばんは (Konbanwa)" },
                                { id: "g3", content: "はじめまして (Hajimemashite)" },
                                { id: "g4", content: "やあ (Yaa)" }
                            ],
                            correctAssignments: { "g1": "Morning", "g2": "Evening", "g3": "Formal", "g4": "Casual" }
                        },
                        initialState: { assignments: {} }
                    },
                    validation: { type: "exact", condition: {} },
                    feedback: { success: "Nice! Your introductions sound natural.", error: "Try matching formality to the situation.", hint: "Use formal lines with new people." }
                }
            ]
        },
        {
            id: "ja-n2",
            title: "Hiragana Chart",
            description: "Identify hiragana characters on the kana chart.",
            type: "concept",
            status: "locked",
            stages: [
                {
                    stageId: "ja-s2",
                    topic: "Locate か (ka)",
                    module: "Instruction",
                    component: "SpatialAnatomy",
                    skin: "Scientific",
                    config: {
                        data: {
                            model: "hiragana-chart",
                            labels: [
                                { id: "a", label: "あ (a)" },
                                { id: "ka", label: "か (ka)" },
                                { id: "sa", label: "さ (sa)" },
                                { id: "ta", label: "た (ta)" }
                            ]
                        },
                        initialState: {}
                    },
                    validation: { type: "exact", condition: { target: "ka" } },
                    feedback: { success: "Correct — that's か!", error: "Try again. Remember the vowel columns.", hint: "Look for the K-row." }
                }
            ]
        },
        {
            id: "ja-n3",
            title: "Basic Particles",
            description: "Understand and apply が / は / を in sentences.",
            type: "exercise",
            status: "locked",
            stages: [
                {
                    stageId: "ja-s3",
                    topic: "Particle Matching",
                    module: "Practice",
                    component: "PatternMatcher",
                    skin: "Code",
                    config: {
                        data: {
                            pairs: [
                                { id: "p1", left: "犬が歩く (inu ga aruku)", right: "subject marker (ga)" },
                                { id: "p2", left: "私は学生です (watashi wa gakusei desu)", right: "topic marker (wa)" },
                                { id: "p3", left: "本を読む (hon o yomu)", right: "object marker (o)" }
                            ]
                        },
                        initialState: {}
                    },
                    validation: { type: "exact", condition: {} },
                    feedback: { success: "Good — particles in place!", error: "Review topic vs subject.", hint: "は marks topic; が often marks subject or new info." }
                }
            ]
        },
        {
            id: "ja-n4",
            title: "Numbers & Counters",
            description: "Use basic counters and say ages.",
            type: "concept",
            status: "locked",
            stages: [
                {
                    stageId: "ja-s4",
                    topic: "Counting Practice",
                    module: "Instruction",
                    component: "TaxonomyMatrix",
                    skin: "Code",
                    config: {
                        data: {
                            buckets: ["Sino-Japanese (on'yomi)", "Native Japanese (kun'yomi)"],
                            items: [
                                { id: "n1", content: "いち (ichi) — 1" },
                                { id: "n2", content: "ふたつ (futatsu) — 2 things" },
                                { id: "n3", content: "さん (san) — 3" },
                                { id: "n4", content: "よっつ (yottsu) — 4 things" },
                                { id: "n5", content: "じゅう (juu) — 10" },
                                { id: "n6", content: "ひとつ (hitotsu) — 1 thing" }
                            ],
                            correctAssignments: { "n1": "Sino-Japanese (on'yomi)", "n2": "Native Japanese (kun'yomi)", "n3": "Sino-Japanese (on'yomi)", "n4": "Native Japanese (kun'yomi)", "n5": "Sino-Japanese (on'yomi)", "n6": "Native Japanese (kun'yomi)" }
                        },
                        initialState: { assignments: {} }
                    },
                    validation: { type: "exact", condition: {} },
                    feedback: { success: "Numbers look good!", error: "Review readings.", hint: "Practice aloud." }
                }
            ]
        },
        {
            id: "ja-n5",
            title: "Present Tense Verbs",
            description: "Conjugate polite present tense for basic verbs.",
            type: "exercise",
            status: "locked",
            stages: [
                {
                    stageId: "ja-s5",
                    topic: "Conjugation Practice",
                    module: "Practice",
                    component: "PatternMatcher",
                    skin: "Scientific",
                    config: {
                        data: {
                            pairs: [
                                { id: "v1", left: "食べる (taberu) — to eat", right: "食べます (tabemasu)" },
                                { id: "v2", left: "行く (iku) — to go", right: "行きます (ikimasu)" }
                            ]
                        },
                        initialState: {}
                    },
                    validation: { type: "exact", condition: {} },
                    feedback: { success: "Polite forms matched!", error: "Review masu-form conjugation.", hint: "Drop -ru and add -masu for ichidan verbs." }
                }
            ]
        },
        {
            id: "ja-n6",
            title: "Adjectives: い / な",
            description: "Differentiate and use い-adjectives and な-adjectives.",
            type: "concept",
            status: "locked",
            stages: [
                {
                    stageId: "ja-s6",
                    topic: "Classify Adjectives",
                    module: "Instruction",
                    component: "TaxonomyMatrix",
                    skin: "Classic",
                    config: {
                        data: { buckets: ["い-adj", "な-adj"], items: [ { id: "ad1", content: "大きい (ookii)" }, { id: "ad2", content: "静か (shizuka)" } ], correctAssignments: { "ad1": "い-adj", "ad2": "な-adj" } },
                        initialState: { assignments: {} }
                    },
                    validation: { type: "exact", condition: {} },
                    feedback: { success: "Adjectives sorted!", error: "Review adjective endings.", hint: "い-adj end with い in plain form." }
                }
            ]
        },
        {
            id: "ja-n7",
            title: "Question Forms",
            description: "Form yes/no and WH-questions.",
            type: "exercise",
            status: "locked",
            stages: [
                {
                    stageId: "ja-s7",
                    topic: "Make Questions",
                    module: "Practice",
                    component: "LogicChain",
                    skin: "Code",
                    config: { data: { nodes: ["Add か for yes/no", "Use 何/どこ/誰 for WH-questions", "Polite ending: ですか?"] }, initialState: {} },
                    validation: { type: "exact", condition: {} },
                    feedback: { success: "Questions formed correctly!", error: "Check particle placement.", hint: "Add か at end for yes/no." }
                }
            ]
        },
        {
            id: "ja-n8",
            title: "Politeness Levels",
            description: "Recognize casual vs polite expressions.",
            type: "concept",
            status: "locked",
            stages: [
                {
                    stageId: "ja-s8",
                    topic: "Identify Politeness",
                    module: "Instruction",
                    component: "TaxonomyMatrix",
                    skin: "Classic",
                    config: { data: { buckets: ["Casual", "Polite"], items: [ { id: "pl1", content: "行く (iku)" }, { id: "pl2", content: "行きます (ikimasu)" } ], correctAssignments: { "pl1": "Casual", "pl2": "Polite" } }, initialState: { assignments: {} } },
                    validation: { type: "exact", condition: {} },
                    feedback: { success: "Politeness recognized!", error: "Review conjugation differences.", hint: "Masu-form = polite." }
                }
            ]
        },
        {
            id: "ja-n9",
            title: "Listening Mini-test",
            description: "Short listening comprehension practice.",
            type: "exercise",
            status: "locked",
            stages: [
                {
                    stageId: "ja-s9",
                    topic: "Listen & Match",
                    module: "Practice",
                    component: "PatternMatcher",
                    skin: "Scientific",
                    config: { data: { pairs: [ { id: "l1", left: "聞こえる: 'おはよう'", right: "Ohayou" } ] }, initialState: {} },
                    validation: { type: "exact", condition: {} },
                    feedback: { success: "Listening good!", error: "Replay and focus on pronunciation.", hint: "Listen for vowels." }
                }
            ]
        },
        {
            id: "ja-n10",
            title: "Final Challenge",
            description: "Comprehensive beginner review.",
            type: "challenge",
            status: "locked",
            stages: [
                {
                    stageId: "ja-s10",
                    topic: "Comprehensive Review",
                    module: "Assessment",
                    component: "TaxonomyMatrix",
                    skin: "Code",
                    config: {
                        data: {
                            buckets: ["Grammar", "Vocabulary"],
                            items: [
                                { id: "f1", content: "Particles" },
                                { id: "f2", content: "Polite forms" },
                                { id: "f3", content: "Hiragana" }
                            ],
                            correctAssignments: { "f1": "Grammar", "f2": "Grammar", "f3": "Vocabulary" }
                        },
                        initialState: { assignments: {} }
                    },
                    validation: { type: "exact", condition: {} },
                    feedback: { success: "Great work — Japanese basics mastered!", error: "Review weak areas.", hint: "Balance vocab and grammar practice." }
                }
            ]
        }
    ]
};
