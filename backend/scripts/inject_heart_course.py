import uuid
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db import registry  # noqa: F401
from app.models.user import UserModel
from app.models.course import CourseModel, NodeModel
from app.models.lesson import LessonModel, LessonStageModel
from app.domain.statuses import CourseStatus, NodeStatus
from app.core.time import utc_now

TARGET_USER_EMAIL = "queeneye888@gmail.com"

COURSE_DATA = {
    "title": "Cardiovascular System",
    "topic": "Human Heart Anatomy & Physiology",
    "description": "A comprehensive deep dive into the human heart, covering anatomy, blood flow, innervation, and the conduction system.",
    "units": [
        {
            "unitId": "heart-u1",
            "unitTitle": "Foundations & Chambers",
            "unitDescription": "Basic anatomy and the four chambers of the heart.",
            "nodes": [
                {
                    "id": "heart-1-1",
                    "title": "CVS Overview",
                    "description": "Pulmonary vs. Systemic circulation.",
                    "stages": [
                        {"component": "ExplainerMedia", "data": {"title": "The Closed Circuit", "explanation": "The CVS is a closed circuit composed of the heart, arteries, capillaries, and veins. Its primary function is supplying O2/nutrients and carrying away CO2/waste.", "bullets": ["Pulmonary: Heart to lungs and back", "Systemic: Heart to rest of body and back"], "mediaType": "image", "mediaUrl": "/images/heart/anterior_view.png", "mediaDescription": "Anatomy of the Heart (Anterior View)"}},
                        {"component": "MultipleChoice", "data": {"question": "What is the primary function of the Pulmonary circulation?", "options": [{"id": "a", "text": "Supply O2 to the rest of the body"}, {"id": "b", "text": "Eliminate CO2 via the lungs"}, {"id": "c", "text": "Deliver nutrients to cells"}, {"id": "d", "text": "Control blood pressure"}], "correctOptionId": "b"}},
                        {"component": "MatchingPairs", "data": {"pairs": [{"id": "p1", "left": "Pulmonary", "right": "Eliminates CO2"}, {"id": "p2", "left": "Systemic", "right": "Delivers O2 to body"}, {"id": "p3", "left": "Arteries", "right": "Carry blood away from heart"}, {"id": "p4", "left": "Veins", "right": "Carry blood to heart"}]}},
                        {"component": "ExplainerMedia", "data": {"title": "The Pump", "explanation": "The heart acts as a cone-shaped, hollow, muscular pump that keeps the blood moving through both divisions of circulation.", "bullets": ["Pulmonary circuit", "Systemic circuit"], "mediaType": "image", "mediaUrl": "/images/heart/valve_locations.png", "mediaDescription": "Location of Heart and Valves in Thoracic Cavity"}},
                        {"component": "FeynmanMirror", "data": {"prompt": "Explain the difference between pulmonary and systemic circulation as if explaining to a 10-year-old.", "sampleAnswer": "Pulmonary is like a short trip to the gas station (lungs) to get fresh air, and systemic is the long delivery route to drop off the air at every house (cell) in the city."}}
                    ]
                },
                {
                    "id": "heart-1-2",
                    "title": "Heart Overview",
                    "description": "Size, mass, and location in the body.",
                    "stages": [
                        {"component": "ExplainerMedia", "data": {"title": "Size, Mass & Power", "explanation": "The adult heart is a powerful pump with a specific size and location, regulated by electrical signals.", "bullets": ["About the size of a fist", "250-350 grams mass", "Driven by electrical action potentials"], "mediaType": "image", "mediaUrl": "/images/heart/action_potential.png", "mediaDescription": "Action Potential of Cardiac Muscle"}},
                        {"component": "MultipleChoice", "data": {"question": "What is the approximate mass of an adult heart?", "options": [{"id": "a", "text": "50-100 grams"}, {"id": "b", "text": "250-350 grams"}, {"id": "c", "text": "500-600 grams"}, {"id": "d", "text": "1 kilogram"}], "correctOptionId": "b"}},
                        {"component": "MatchingPairs", "data": {"pairs": [{"id": "p1", "left": "Mass", "right": "250-350 grams"}, {"id": "p2", "left": "Size", "right": "Clenched fist"}, {"id": "p3", "left": "Position", "right": "2/3 left of midline"}, {"id": "p4", "left": "Apex", "right": "5th intercostal space"}]}},
                        {"component": "ExplainerMedia", "data": {"title": "Regulation & Control", "explanation": "The heart sits 2/3 to the left of the midline and its rate is controlled by the autonomic nervous system via the vagus and sympathetic nerves.", "bullets": ["Posterior to sternum", "Controlled by Medulla oblongata", "Rate adjusted by Vagus nerve"], "mediaType": "image", "mediaUrl": "/images/heart/nerve_supply.png", "mediaDescription": "Nerve Supply to the Heart (Autonomic Control)"}},
                        {"component": "FeynmanMirror", "data": {"prompt": "Describe where the heart is located and how its rate is controlled.", "sampleAnswer": "The heart sits in the middle-left of the chest. It's like a self-driving car that can go faster (sympathetic) or slower (vagus nerve) depending on what the brain tells it."}}
                    ]
                },
                {
                    "id": "heart-1-3",
                    "title": "External Anatomy",
                    "description": "Base, Apex, and the five surfaces.",
                    "stages": [
                        {"component": "ExplainerMedia", "data": {"title": "Base & Apex", "explanation": "The Base is formed by atria (mostly left) beneath the 2nd rib. The Apex is formed by the left ventricle at the 5th intercostal space.", "bullets": ["Base: Top part (atria)", "Apex: Bottom pointed part (LV)"]}},
                        {"component": "MatchingPairs", "data": {"pairs": [{"id": "p1", "left": "Base", "right": "Left Atrium (2nd rib)"}, {"id": "p2", "left": "Apex", "right": "Left Ventricle (5th intercostal)"}]}},
                        {"component": "ExplainerMedia", "data": {"title": "Surfaces", "explanation": "The heart has several named surfaces based on what they touch.", "bullets": ["Inferior: Diaphragmatic", "Anterior: Sternocostal", "Left: Pulmonary"]}},
                        {"component": "MultipleChoice", "data": {"question": "Which surface of the heart is primarily formed by the right ventricle?", "options": [{"id": "a", "text": "Inferior surface"}, {"id": "b", "text": "Anterior (Sternocostal) surface"}, {"id": "c", "text": "Left pulmonary surface"}, {"id": "d", "text": "Base"}], "correctOptionId": "b"}},
                        {"component": "FeynmanMirror", "data": {"prompt": "If you could touch the heart inside the chest, what would the apex feel like and where would it be?", "sampleAnswer": "The apex is the pointy tip of the heart at the bottom left, made of the strong left ventricle, and you can feel it beating between the 5th and 6th ribs."}}
                    ]
                },
                {
                    "id": "heart-1-4",
                    "title": "Pericardium",
                    "description": "The protective layers (Fibrous & Serous).",
                    "stages": [
                        {"component": "ExplainerMedia", "data": {"title": "Protective Sac", "explanation": "The pericardium covers the heart, restricts movement, and prevents overfilling.", "bullets": ["Fibrous: Tough outer layer", "Serous: Inner double layer"]}},
                        {"component": "MultipleChoice", "data": {"question": "Which layer of the pericardium is composed of tough dense connective tissue?", "options": [{"id": "a", "text": "Serous pericardium"}, {"id": "b", "text": "Fibrous pericardium"}, {"id": "c", "text": "Epicardium"}, {"id": "d", "text": "Endocardium"}], "correctOptionId": "b"}},
                        {"component": "ExplainerMedia", "data": {"title": "Serous Subdivisions", "explanation": "The serous pericardium has a parietal layer (lining the fibrous part) and a visceral layer (epicardium, covering the heart).", "bullets": ["Pericardial cavity: Space between layers", "Serous fluid: Lubricates and reduces friction"]}},
                        {"component": "Ordering", "data": {"question": "Order the pericardium layers from outside to inside:", "steps": ["Fibrous Pericardium", "Parietal layer (Serous)", "Pericardial Cavity", "Visceral layer (Epicardium)"]}},
                        {"component": "FeynmanMirror", "data": {"prompt": "Why is the serous fluid in the pericardial cavity important?", "sampleAnswer": "The fluid acts like oil in an engine; it lets the heart beat smoothly without rubbing or create friction against its protective sac."}}
                    ]
                },
                {
                    "id": "heart-1-5",
                    "title": "Heart Wall Layers",
                    "description": "Epicardium, Myocardium, and Endocardium.",
                    "stages": [
                        {"component": "ExplainerMedia", "data": {"title": "Wall Thickness", "explanation": "The heart wall consists of three distinct layers with different functions.", "bullets": ["Epicardium (Outer)", "Myocardium (Middle/Muscular)", "Endocardium (Inner/Lining)"]}},
                        {"component": "MultipleChoice", "data": {"question": "Which is the thickest layer of the heart wall?", "options": [{"id": "a", "text": "Epicardium"}, {"id": "b", "text": "Myocardium"}, {"id": "c", "text": "Endocardium"}, {"id": "d", "text": "Pericardium"}], "correctOptionId": "b"}},
                        {"component": "MatchingPairs", "data": {"pairs": [{"id": "p1", "left": "Epi-", "right": "Upon/Above"}, {"id": "p2", "left": "Myo-", "right": "Muscle"}, {"id": "p3", "left": "Endo-", "right": "Within"}]}},
                        {"component": "ExplainerMedia", "data": {"title": "Endocardium", "explanation": "The endocardium covers the valves and is continuous with the endothelium of blood vessels.", "bullets": ["Composed of simple squamous epithelium", "Covers valve surfaces"]}},
                        {"component": "FeynmanMirror", "data": {"prompt": "Describe the composition and role of the myocardium.", "sampleAnswer": "The myocardium is the thick, muscular middle layer of the heart that does the actual work of pumping blood by contracting."}}
                    ]
                },
                {
                    "id": "heart-1-6",
                    "title": "Right Atrium",
                    "description": "Openings, Fossa Ovalis, and Tricuspid valve.",
                    "stages": [
                        {"component": "ExplainerMedia", "data": {"title": "Receiving Chamber", "explanation": "The Right Atrium receives deoxygenated blood and passes it to the right ventricle through the tricuspid valve.", "bullets": ["Receives from SVC, IVC, and Coronary Sinus", "Passes to RV"]}},
                        {"component": "MultipleChoice", "data": {"question": "Which structure brings blood from the lower limbs into the right atrium?", "options": [{"id": "a", "text": "Superior vena cava"}, {"id": "b", "text": "Inferior vena cava"}, {"id": "c", "text": "Coronary sinus"}, {"id": "d", "text": "Pulmonary artery"}], "correctOptionId": "b"}},
                        {"component": "ExplainerMedia", "data": {"title": "Fossa Ovalis", "explanation": "The Fossa Ovalis is an oval depression in the interatrial septum, representing a remnant of the fetal foramen ovale.", "bullets": ["Interatrial septum: Wall between atria", "Fetal remnant"]}},
                        {"component": "MatchingPairs", "data": {"pairs": [{"id": "p1", "left": "SVC", "right": "Upper body blood"}, {"id": "p2", "left": "IVC", "right": "Lower body blood"}, {"id": "p3", "left": "Coronary Sinus", "right": "Heart wall blood"}]}},
                        {"component": "FeynmanMirror", "data": {"prompt": "What is the fossa ovalis and why is it there?", "sampleAnswer": "It's a small dent in the wall between the two upper chambers. It used to be a hole (foramen ovale) when we were in the womb to let blood bypass the lungs."}}
                    ]
                },
                {
                    "id": "heart-1-7",
                    "title": "Right Ventricle",
                    "description": "Structure, Interventricular Septum, and Pulmonary Trunk.",
                    "stages": [
                        {"component": "ExplainerMedia", "data": {"title": "Anterior Surface", "explanation": "The Right Ventricle forms most of the anterior surface of the heart.", "bullets": ["Receives blood from Right Atrium", "Pumps to Pulmonary Trunk"]}},
                        {"component": "MultipleChoice", "data": {"question": "Blood leaves the right ventricle and enters into which structure?", "options": [{"id": "a", "text": "Aorta"}, {"id": "b", "text": "Pulmonary trunk"}, {"id": "c", "text": "Left atrium"}, {"id": "d", "text": "Superior vena cava"}], "correctOptionId": "b"}},
                        {"component": "ExplainerMedia", "data": {"title": "Septum & Valves", "explanation": "The interventricular septum is a thick wall separating the two ventricles. The tricuspid valve guards the entry from the right atrium.", "bullets": ["Interventricular septum: Thick muscle", "Tricuspid valve: 3 cusps"]}},
                        {"component": "Ordering", "data": {"question": "Order the flow of blood through the right side of the heart:", "steps": ["Right Atrium", "Tricuspid Valve", "Right Ventricle", "Pulmonary Valve", "Pulmonary Trunk"]}},
                        {"component": "FeynmanMirror", "data": {"prompt": "Where does the right ventricle pump blood and why?", "sampleAnswer": "It pumps blue (deoxygenated) blood to the lungs through the pulmonary trunk so the blood can pick up fresh oxygen."}}
                    ]
                },
                {
                    "id": "heart-1-8",
                    "title": "Left Atrium & Ventricle",
                    "description": "Pulmonary veins, Mitral valve, and Systemic Output.",
                    "stages": [
                        {"component": "ExplainerMedia", "data": {"title": "Oxygenated Blood", "explanation": "The Left Atrium receives oxygenated blood from the pulmonary veins and passes it to the Left Ventricle via the Mitral (Bicuspid) valve.", "bullets": ["4 Pulmonary veins", "Mitral (Bicuspid) valve"]}},
                        {"component": "MultipleChoice", "data": {"question": "What is the alternative name for the Mitral valve?", "options": [{"id": "a", "text": "Tricuspid valve"}, {"id": "b", "text": "Bicuspid valve"}, {"id": "c", "text": "Semilunar valve"}, {"id": "d", "text": "Aortic valve"}], "correctOptionId": "b"}},
                        {"component": "ExplainerMedia", "data": {"title": "The Strongest Chamber", "explanation": "The Left Ventricle pumps blood into the Aorta. Its wall is 2-3 times thicker than the right ventricle to generate higher pressure.", "bullets": ["Pumps to Aorta", "Thickest myocardium"]}},
                        {"component": "MatchingPairs", "data": {"pairs": [{"id": "p1", "left": "Right Ventricle", "right": "Thin wall / Lungs"}, {"id": "p2", "left": "Left Ventricle", "right": "Thick wall / Body"}]}},
                        {"component": "FeynmanMirror", "data": {"prompt": "Why is the left ventricle so much thicker than the right?", "sampleAnswer": "Because the right only has to push blood to the nearby lungs, while the left has to push blood through the entire body from head to toe."}}
                    ]
                },
                {
                    "id": "heart-1-9",
                    "title": "Heart Valves",
                    "description": "AV and Semilunar valves in action.",
                    "stages": [
                        {"component": "ExplainerMedia", "data": {"title": "Valve Types", "explanation": "There are two types of valves to ensure one-way blood flow.", "bullets": ["Atrioventricular (AV): Tricuspid & Mitral", "Semilunar: Pulmonary & Aortic"]}},
                        {"component": "MultipleChoice", "data": {"question": "When do semilunar valves open?", "options": [{"id": "a", "text": "When atria contract"}, {"id": "b", "text": "When ventricles contract"}, {"id": "c", "text": "When the heart is at rest"}, {"id": "d", "text": "Always open"}], "correctOptionId": "b"}},
                        {"component": "ExplainerMedia", "data": {"title": "Semilunar Features", "explanation": "Semilunar valves (Aortic and Pulmonary) each have 3 cusps and guard the exit to the great vessels.", "bullets": ["Aortic valve: LV to Aorta", "Pulmonary valve: RV to Pulmonary trunk"]}},
                        {"component": "MatchingPairs", "data": {"pairs": [{"id": "p1", "left": "Mitral", "right": "Open in diastole"}, {"id": "p2", "left": "Aortic", "right": "Open in systole"}]}},
                        {"component": "FeynmanMirror", "data": {"prompt": "Explain what causes heart valves to open and close.", "sampleAnswer": "Valves are like one-way doors. They open when the pressure behind them is higher than in front, and slam shut when blood tries to flow back the wrong way."}}
                    ]
                },
                {
                    "id": "heart-1-10",
                    "title": "Sulci & Skeleton",
                    "description": "Surface grooves and the fibrous skeleton.",
                    "stages": [
                        {"component": "ExplainerMedia", "data": {"title": "Surface Landmarks", "explanation": "Sulci (grooves) on the heart surface separate the chambers.", "bullets": ["Coronary Sulcus: Separates Atria/Ventricles", "Interventricular Sulci: Separate LV/RV"]}},
                        {"component": "MultipleChoice", "data": {"question": "What is the alternative name for the Coronary Sulcus?", "options": [{"id": "a", "text": "Interventricular sulcus"}, {"id": "b", "text": "Atrioventricular sulcus"}, {"id": "c", "text": "Fossa ovalis"}, {"id": "d", "text": "Sulcus terminalis"}], "correctOptionId": "b"}},
                        {"component": "ExplainerMedia", "data": {"title": "Fibrous Skeleton", "explanation": "A layer of dense tissue between atria and ventricles.", "bullets": ["Anchors valves", "Provides electrical insulation"]}},
                        {"component": "MultipleChoice", "data": {"question": "Why is electrical insulation by the fibrous skeleton important?", "options": [{"id": "a", "text": "To stop blood flow"}, {"id": "b", "text": "To prevent all chambers from contracting at once"}, {"id": "c", "text": "To keep the heart warm"}, {"id": "d", "text": "To increase heart rate"}], "correctOptionId": "b"}},
                        {"component": "FeynmanMirror", "data": {"prompt": "What are the two 'jobs' of the heart's fibrous skeleton?", "sampleAnswer": "It acts like a sturdy frame for the valves to hang on, and it acts like rubber insulation on a wire to stop electrical signals from jumping between the top and bottom chambers too soon."}}
                    ]
                },
                {
                    "id": "heart-1-11",
                    "title": "Coronary Arteries",
                    "description": "Right and Left system of blood supply.",
                    "stages": [
                        {"component": "ExplainerMedia", "data": {"title": "Self-Supply", "explanation": "The heart gets its own blood from the right and left coronary arteries, which originate from the ascending aorta.", "bullets": ["Arises from Aorta", "Left vs. Right Coronary"]}},
                        {"component": "MultipleChoice", "data": {"question": "Which artery supplies the anterior surface of both ventricles?", "options": [{"id": "a", "text": "Right marginal artery"}, {"id": "b", "text": "Anterior interventricular artery (LAD)"}, {"id": "c", "text": "Posterior interventricular artery"}, {"id": "d", "text": "Circumflex artery"}], "correctOptionId": "b"}},
                        {"component": "ExplainerMedia", "data": {"title": "Branches", "explanation": "Right Coronary: Marginal and Posterior Interventricular branches. Left Coronary: Anterior Interventricular and Circumflex branches.", "bullets": ["Left Anterior Descending (LAD) is critical", "Circumflex: Supplies Left Atrium/Ventricle"]}},
                        {"component": "MatchingPairs", "data": {"pairs": [{"id": "p1", "left": "Circumflex", "right": "Left Coronary branch"}, {"id": "p2", "left": "Marginal", "right": "Right Coronary branch"}]}},
                        {"component": "FeynmanMirror", "data": {"prompt": "What happens if a coronary artery gets blocked?", "sampleAnswer": "The heart muscle past the blockage won't get oxygen and can start to die—this is what we call a heart attack."}}
                    ]
                },
                {
                    "id": "heart-1-12",
                    "title": "Coronary Veins",
                    "description": "Venous drainage and the Coronary Sinus.",
                    "stages": [
                        {"component": "ExplainerMedia", "data": {"title": "Drainage Route", "explanation": "Deoxygenated blood from the heart wall is collected by cardiac veins and emptied into the coronary sinus.", "bullets": ["Great, Middle, and Small cardiac veins", "Coronary Sinus: Large collecting vein"]}},
                        {"component": "MultipleChoice", "data": {"question": "Where does the coronary sinus open directly into?", "options": [{"id": "a", "text": "Left atrium"}, {"id": "b", "text": "Right atrium"}, {"id": "c", "text": "Aorta"}, {"id": "d", "text": "Superior vena cava"}], "correctOptionId": "b"}},
                        {"component": "MatchingPairs", "data": {"pairs": [{"id": "p1", "left": "Great Cardiac Vein", "right": "Anterior surface"}, {"id": "p2", "left": "Middle Cardiac Vein", "right": "Posterior surface"}]}},
                        {"component": "ExplainerMedia", "data": {"title": "Anastomoses", "explanation": "Connections among smaller arteries are called anastomoses. They can provide backup routes for blood.", "bullets": ["Protective connections", "Delay ischemic symptoms"]}},
                        {"component": "FeynmanMirror", "data": {"prompt": "Where does the 'used' blood from the heart muscle go before return to circulation?", "sampleAnswer": "It collects in the coronary sinus (a big vein on the back of the heart) which then dumps it straight back into the right atrium."}}
                    ]
                },
                {
                    "id": "heart-1-13",
                    "title": "Nerve Supply",
                    "description": "Autonomic control: Vagus nerve & Sympathetic effects.",
                    "stages": [
                        {"component": "ExplainerMedia", "data": {"title": "Autonomic Control", "explanation": "The heart is influenced by the autonomic nervous system to speed up or slow down.", "bullets": ["Sympathetic: Increase rate", "Parasympathetic: Decrease rate"]}},
                        {"component": "MultipleChoice", "data": {"question": "Which nerve provides parasympathetic stimulation to the heart?", "options": [{"id": "a", "text": "Phrenic nerve"}, {"id": "b", "text": "Vagus nerve (CN X)"}, {"id": "c", "text": "Sciatic nerve"}, {"id": "d", "text": "Trigeminal nerve"}], "correctOptionId": "b"}},
                        {"component": "ExplainerMedia", "data": {"title": "Sympathetic Effects", "explanation": "Sympathetic stimulation (T1-T2) leads to Tachycardia (increased rate) and increased force of contraction.", "bullets": ["Tachycardia", "Dilation of coronary arteries"]}},
                        {"component": "MatchingPairs", "data": {"pairs": [{"id": "p1", "left": "Tachycardia", "right": "Increased Heart Rate"}, {"id": "p2", "left": "Bradycardia", "right": "Decreased Heart Rate"}]}},
                        {"component": "FeynmanMirror", "data": {"prompt": "How does the 'Fight or Flight' response affect your heart?", "sampleAnswer": "The sympathetic nervous system kicks in, making your heart beat faster and harder to get more oxygen to your muscles so you can run or fight."}}
                    ]
                },
                {
                    "id": "heart-1-14",
                    "title": "Conduction System",
                    "description": "SA, AV, Bundle of His, and Purkinje fibers.",
                    "stages": [
                        {"component": "ExplainerMedia", "data": {"title": "The Pacemaker", "explanation": "The Sinoatrial (SA) node is the heart's natural pacemaker, located in the right atrium wall.", "bullets": ["Originates heartbeat", "Near SVC junction"]}},
                        {"component": "MultipleChoice", "data": {"question": "Where is the AV node located?", "options": [{"id": "a", "text": "Apex of the heart"}, {"id": "b", "text": "Posterior wall of right atrium"}, {"id": "c", "text": "Right posterior portion of interatrial septum"}, {"id": "d", "text": "In the aorta"}], "correctOptionId": "c"}},
                        {"component": "Ordering", "data": {"question": "Order the electrical signal pathway:", "steps": ["SA Node", "AV Node", "Bundle of His", "Left/Right Branches", "Purkinje Fibers"]}},
                        {"component": "ExplainerMedia", "data": {"title": "Intrinsic Ability", "explanation": "The conduction system can stimulate cardiac contraction even without external nerve signals.", "bullets": ["Purkinje: Extend through ventricle walls", "Spreads to all myocardium"]}},
                        {"component": "FeynmanMirror", "data": {"prompt": "Describe the journey of an electrical spark through the heart.", "sampleAnswer": "It starts at the SA node (the spark plug), pauses at the AV node (the waiting room), travels down the Bundle of His (the hallway), and spreads through the Purkinje fibers (the network) to make the ventricles squeeze."}}
                    ]
                },
                {
                    "id": "heart-1-15",
                    "title": "Cycle & Sounds",
                    "description": "Systole, Diastole, and Labb/Dupp.",
                    "stages": [
                        {"component": "ExplainerMedia", "data": {"title": "Systole & Diastole", "explanation": "The cardiac cycle includes one contraction (systole) and one relaxation (diastole).", "bullets": ["Systole: Contraction", "Diastole: Relaxation"]}},
                        {"component": "MultipleChoice", "data": {"question": "What percentage of blood flows passively into the ventricles during diastole?", "options": [{"id": "a", "text": "20%"}, {"id": "b", "text": "50%"}, {"id": "c", "text": "80%"}, {"id": "d", "text": "100%"}], "correctOptionId": "c"}},
                        {"component": "ExplainerMedia", "data": {"title": "Heart Sounds", "explanation": "The Lub-Dub sounds are caused by the closing of heart valves.", "bullets": ["Labb (Lub): Closing AV valves", "Dupp (Dub): Closing SL valves"]}},
                        {"component": "MatchingPairs", "data": {"pairs": [{"id": "p1", "left": "Labb", "right": "Tricuspid/Mitral close"}, {"id": "p2", "left": "Dupp", "right": "Aortic/Pulmonary close"}]}},
                        {"component": "FeynmanMirror", "data": {"prompt": "What exactly are you hearing when the doctor listens to your heartbeat?", "sampleAnswer": "You're hearing the 'clunk' of the one-way valves slamming shut to keep the blood moving in the right direction—first the top ones, then the bottom ones."}}
                    ]
                }
            ]
        }
    ]
}

def build_syllabus_json(course_def: dict) -> dict:
    units = []
    first_node = True
    for unit_def in course_def["units"]:
        nodes = []
        for node_def in unit_def["nodes"]:
            nodes.append({
                "id": node_def["id"],
                "title": node_def["title"],
                "description": node_def.get("description", ""),
                "status": "available" if first_node else "locked",
                "hasGeneratedLesson": True,
            })
            first_node = False
        units.append({
            "unitId": unit_def["unitId"],
            "unitTitle": unit_def["unitTitle"],
            "unitDescription": unit_def.get("unitDescription", ""),
            "nodes": nodes,
        })
    return {
        "courseTitle": course_def["title"],
        "description": course_def["description"],
        "units": units,
    }

def build_stage_snapshot(stage_def: dict) -> dict:
    component = stage_def["component"]
    data = stage_def["data"]
    sid = str(uuid.uuid4())[:8]
    
    return {
        "stageId": f"stage-{sid}",
        "topic": stage_def.get("topic", "Anatomy Detail"),
        "skin": "Scientific",
        "component": component,
        "difficulty": stage_def.get("difficulty", "medium"),
        "recommendedDurationMinutes": 3,
        "config": {
            "data": data,
            "initialState": {},
        },
        "validation": {"type": "logic", "condition": None},
        "feedback": {"success": "Great job!", "error": "Not quite right. Try again!"},
    }

def inject():
    db: Session = SessionLocal()
    user = db.query(UserModel).filter(UserModel.email == TARGET_USER_EMAIL).first()
    if not user:
        print(f"User {TARGET_USER_EMAIL} not found.")
        return

    print(f"Injecting full 15-node course into user {user.email}'s library...")
    
    now = utc_now()
    syllabus = build_syllabus_json(COURSE_DATA)
    
    # Upsert course
    existing = db.query(CourseModel).filter(
        CourseModel.user_id == user.id,
        CourseModel.title == COURSE_DATA["title"]
    ).first()
    
    if existing:
        print(f"Course {COURSE_DATA['title']} already exists. Updating and refreshing nodes...")
        # Clear child tables first
        db.query(LessonStageModel).filter(LessonStageModel.lesson_id.in_(
            db.query(LessonModel.id).filter(LessonModel.course_id == existing.id)
        )).delete(synchronize_session=False)
        db.query(LessonModel).filter(LessonModel.course_id == existing.id).delete()
        db.query(NodeModel).filter(NodeModel.course_id == existing.id).delete()
        
        existing.topic = COURSE_DATA["topic"]
        existing.syllabus_json = syllabus
        existing.updated_at = now
        course = existing
    else:
        course = CourseModel(
            user_id=user.id,
            title=COURSE_DATA["title"],
            topic=COURSE_DATA["topic"],
            status=CourseStatus.READY,
            folder_name=str(uuid.uuid4()),
            profile_json={"summary": "Comprehensive 15-node Cardiovascular course."},
            draft_json={"topic": COURSE_DATA["topic"]},
            syllabus_json=syllabus,
            created_at=now,
            updated_at=now,
        )
        db.add(course)
    
    db.flush()
    
    for unit_def in COURSE_DATA["units"]:
        for node_def in unit_def["nodes"]:
            is_first = node_def["id"] == COURSE_DATA["units"][0]["nodes"][0]["id"]
            node_status = NodeStatus.AVAILABLE if is_first else NodeStatus.LOCKED

            db_node = NodeModel(
                course_id=course.id,
                node_id=node_def["id"],
                title=node_def["title"],
                status=node_status,
                data={"description": node_def.get("description", "")},
            )
            db.add(db_node)
            db.flush() # Need node.id for lessons

            stages_data = []
            for s_def in node_def["stages"]:
                if "topic" not in s_def:
                    s_def["topic"] = node_def["title"]
                stages_data.append(build_stage_snapshot(s_def))

            lesson = LessonModel(
                user_id=user.id,
                course_id=course.id,
                node_id=db_node.node_id,
                course_topic=COURSE_DATA["topic"],
                status="generated",
                stage_count=len(stages_data),
                question_count=len(stages_data),
                estimated_duration_minutes=len(stages_data) * 3,
                schema_version=2,
                generator_provider="injection-script",
                generator_model="comprehensive-15-node",
                created_at=now,
                updated_at=now,
            )
            db.add(lesson)
            db.flush()

            for idx, stage_snapshot in enumerate(stages_data):
                stage_model = LessonStageModel(
                    lesson_id=lesson.id,
                    stage_uid=stage_snapshot["stageId"],
                    stage_order=idx,
                    stage_type="interactive",
                    topic=stage_snapshot["topic"],
                    skin=stage_snapshot["skin"],
                    component=stage_snapshot["component"],
                    difficulty=stage_snapshot.get("difficulty"),
                    recommended_duration_minutes=stage_snapshot.get("recommendedDurationMinutes"),
                    item_count=1,
                    schema_version=2,
                    content_json=stage_snapshot["config"]["data"],
                    validation_json=stage_snapshot["validation"],
                    feedback_json=stage_snapshot["feedback"],
                    stage_snapshot_json=stage_snapshot,
                    created_at=now,
                    updated_at=now,
                )
                db.add(stage_model)

    db.commit()
    print(f"Injection complete! 15 nodes and {len(COURSE_DATA['units'][0]['nodes']) * 5} stages created.")

if __name__ == "__main__":
    inject()
