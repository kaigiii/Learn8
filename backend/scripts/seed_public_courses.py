"""
seed_public_courses.py  –  Populate 3 public courses fully loaded with lessons.

Each course contains 3 units × 6 nodes = 18 nodes.
Each node has 1 Lesson with 3 interactive stages using the 5 game module types.

Usage:
    cd backend
    python3.12 -m scripts.seed_public_courses
"""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.core.time import utc_now_naive
from app.db import registry as _registry  # noqa: F401  – ensures all models are mapped
from app.db.session import SessionLocal
from app.domain.statuses import CourseStatus, NodeStatus
from app.models.course import CourseModel, NodeModel
from app.models.lesson import LessonModel, LessonStageModel
from app.models.user import UserModel

# ---------------------------------------------------------------------------
# System user
# ---------------------------------------------------------------------------
SYSTEM_EMAIL = "public@learn8.system"
SYSTEM_NAME = "Learn8 Public"

# ---------------------------------------------------------------------------
# The 5 game-module component names (must match YAML registry)
# ---------------------------------------------------------------------------
COMPONENTS = [
    "MultipleChoice",
    "Ordering",
    "MatchingPairs",
    "FeynmanMirror",
    "ExplainerMedia",
]

# ---------------------------------------------------------------------------
# Stage content factories  –  one per component type
# ---------------------------------------------------------------------------

def _mc(topic: str, q: str, opts: list[dict], correct: str, diff: str = "medium") -> dict:
    """Build a MultipleChoice stage dict."""
    return _stage(topic, "MultipleChoice", diff, {
        "data": {"question": q, "options": opts, "correctOptionId": correct},
        "initialState": {},
    })


def _order(topic: str, prompt: str, steps: list[str], diff: str = "medium") -> dict:
    return _stage(topic, "Ordering", diff, {
        "data": {"question": prompt, "steps": steps},
        "initialState": {},
    })


def _match(topic: str, pairs: list[dict], diff: str = "medium") -> dict:
    return _stage(topic, "MatchingPairs", diff, {
        "data": {"pairs": pairs},
        "initialState": {},
    })


def _feynman(topic: str, prompt: str, sample: str, diff: str = "medium") -> dict:
    return _stage(topic, "FeynmanMirror", diff, {
        "data": {"prompt": prompt, "sampleAnswer": sample},
        "initialState": {},
    })


def _explain(topic: str, title: str, explanation: str, bullets: list[str], diff: str = "low") -> dict:
    return _stage(topic, "ExplainerMedia", diff, {
        "data": {"title": title, "explanation": explanation, "bullets": bullets, "mediaType": "none"},
        "initialState": {},
    })


def _stage(topic: str, component: str, difficulty: str, config: dict) -> dict:
    sid = str(uuid.uuid4())[:8]
    return {
        "stageId": f"stage-{sid}",
        "topic": topic,
        "skin": "Scientific",
        "component": component,
        "difficulty": difficulty,
        "recommendedDurationMinutes": 3,
        "config": config,
        "validation": {"type": "logic", "condition": None},
        "feedback": {"success": "Great job!", "error": "Not quite right. Try again!"},
    }


# ---------------------------------------------------------------------------
# Course definitions  –  3 courses × 3 units × 6 nodes, each with 3 stages
# ---------------------------------------------------------------------------

COURSES: list[dict[str, Any]] = [
    {
        "title": "AI & Neural Networks",
        "topic": "Artificial Intelligence & Neural Networks",
        "description": "A comprehensive expedition through the mechanics of neural networks, backpropagation, and modern architectures.",
        "units": [
            {
                "unitId": "ai-u1", "unitTitle": "Foundations",
                "unitDescription": "Mathematical and structural fundamentals of neural networks.",
                "nodes": [
                    {"id": "ai-1-1", "title": "Biological vs Artificial Neurons", "desc": "The perceptron and its biological inspiration.",
                     "stages": [
                         _explain("Biological vs Artificial Neurons", "What is a Neuron?", "A neuron receives inputs, applies weights, sums them, and passes through an activation function.", ["Inputs × Weights → Sum → Activation", "Inspired by biological synapses"]),
                         _mc("Biological vs Artificial Neurons", "What does a perceptron compute?", [{"id":"a","text":"Weighted sum + activation"},{"id":"b","text":"Random output"},{"id":"c","text":"Image recognition"},{"id":"d","text":"Sorting"}], "a"),
                         _feynman("Biological vs Artificial Neurons", "Explain in your own words how a single artificial neuron works.", "A neuron takes weighted inputs, sums them, adds a bias, and passes the result through an activation function to produce output."),
                     ]},
                    {"id": "ai-1-2", "title": "Activation Functions", "desc": "Sigmoid, ReLU, Tanh and their roles.",
                     "stages": [
                         _mc("Activation Functions", "Which activation function outputs values between 0 and 1?", [{"id":"a","text":"ReLU"},{"id":"b","text":"Sigmoid"},{"id":"c","text":"Tanh"},{"id":"d","text":"Softmax"}], "b"),
                         _match("Activation Functions", [{"id":"p1","left":"ReLU","right":"max(0, x)"},{"id":"p2","left":"Sigmoid","right":"1/(1+e^-x)"},{"id":"p3","left":"Tanh","right":"(e^x - e^-x)/(e^x + e^-x)"},{"id":"p4","left":"Softmax","right":"Probability distribution"}]),
                         _order("Activation Functions", "Order these activation functions from oldest to newest:", ["Step Function", "Sigmoid", "Tanh", "ReLU"]),
                     ]},
                    {"id": "ai-1-3", "title": "Forward Propagation", "desc": "How data flows through a dense network.",
                     "stages": [
                         _explain("Forward Propagation", "Forward Pass", "Data enters at the input layer, gets multiplied by weights at each connection, summed at each neuron, and passed through activation functions until reaching the output.", ["Input → Hidden → Output", "Each layer transforms the data"]),
                         _order("Forward Propagation", "Order the steps of forward propagation:", ["Receive input values", "Multiply by weights", "Sum weighted inputs + bias", "Apply activation function"]),
                         _mc("Forward Propagation", "In forward propagation, data flows in which direction?", [{"id":"a","text":"Output to input"},{"id":"b","text":"Input to output"},{"id":"c","text":"Randomly"},{"id":"d","text":"Bidirectionally"}], "b"),
                     ]},
                    {"id": "ai-1-4", "title": "Loss Functions", "desc": "MSE, Cross-entropy and optimization basics.",
                     "stages": [
                         _mc("Loss Functions", "Which loss function is typically used for classification?", [{"id":"a","text":"MSE"},{"id":"b","text":"MAE"},{"id":"c","text":"Cross-Entropy"},{"id":"d","text":"Huber"}], "c"),
                         _match("Loss Functions", [{"id":"p1","left":"MSE","right":"Regression tasks"},{"id":"p2","left":"Cross-Entropy","right":"Classification tasks"},{"id":"p3","left":"MAE","right":"Robust to outliers"},{"id":"p4","left":"Huber","right":"Combines MSE and MAE"}]),
                         _feynman("Loss Functions", "Explain what a loss function does and why it matters.", "A loss function quantifies how far the model's predictions are from the true values, guiding the optimizer to adjust weights."),
                     ]},
                    {"id": "ai-1-5", "title": "Gradient Descent", "desc": "How models learn by following the gradient.",
                     "stages": [
                         _explain("Gradient Descent", "Walking Downhill", "Gradient descent finds the minimum of the loss function by iteratively adjusting parameters in the direction of steepest descent.", ["Learning rate controls step size", "Too large → overshoot, too small → slow"]),
                         _order("Gradient Descent", "Order the gradient descent algorithm steps:", ["Compute predictions", "Calculate loss", "Compute gradients", "Update weights"]),
                         _mc("Gradient Descent", "What happens if the learning rate is too large?", [{"id":"a","text":"Converges faster"},{"id":"b","text":"Overshoots the minimum"},{"id":"c","text":"Nothing changes"},{"id":"d","text":"Model freezes"}], "b"),
                     ]},
                    {"id": "ai-1-6", "title": "Backpropagation", "desc": "The chain rule for training deep networks.",
                     "stages": [
                         _mc("Backpropagation", "Backpropagation uses which calculus concept?", [{"id":"a","text":"Integration"},{"id":"b","text":"Chain Rule"},{"id":"c","text":"Limits"},{"id":"d","text":"Series"}], "b"),
                         _order("Backpropagation", "Order the backpropagation process:", ["Forward pass to compute output", "Calculate loss at output layer", "Propagate error backwards layer by layer", "Update weights using gradients"]),
                         _feynman("Backpropagation", "Explain backpropagation as if teaching a friend.", "Backpropagation calculates how much each weight contributed to the error by applying the chain rule backwards through the network, then adjusts weights to reduce the error."),
                     ]},
                ],
            },
            {
                "unitId": "ai-u2", "unitTitle": "Training Techniques",
                "unitDescription": "Practical techniques for training robust models.",
                "nodes": [
                    {"id": "ai-2-1", "title": "Batch vs Stochastic GD", "desc": "Mini-batch, batch and SGD trade-offs.",
                     "stages": [
                         _mc("Batch vs SGD", "Which method updates weights after every single sample?", [{"id":"a","text":"Batch GD"},{"id":"b","text":"SGD"},{"id":"c","text":"Mini-batch GD"},{"id":"d","text":"Adam"}], "b"),
                         _match("Batch vs SGD", [{"id":"p1","left":"Batch GD","right":"Uses entire dataset per update"},{"id":"p2","left":"SGD","right":"Uses one sample per update"},{"id":"p3","left":"Mini-batch","right":"Uses small subsets per update"},{"id":"p4","left":"Adam","right":"Adaptive learning rate optimizer"}]),
                         _explain("Batch vs SGD", "Choosing Your Strategy", "Batch GD is stable but slow. SGD is noisy but fast. Mini-batch combines both benefits and is the standard approach.", ["Mini-batch size: typically 32-256", "SGD adds regularization via noise"]),
                     ]},
                    {"id": "ai-2-2", "title": "Vanishing Gradients", "desc": "Why deep networks struggle to learn.",
                     "stages": [
                         _explain("Vanishing Gradients", "The Vanishing Problem", "When gradients shrink exponentially through many layers, early layers stop learning. This is the vanishing gradient problem.", ["Sigmoid/Tanh are prone to this", "ReLU helps mitigate it"]),
                         _mc("Vanishing Gradients", "Which activation function helps mitigate vanishing gradients?", [{"id":"a","text":"Sigmoid"},{"id":"b","text":"Tanh"},{"id":"c","text":"ReLU"},{"id":"d","text":"Step Function"}], "c"),
                         _feynman("Vanishing Gradients", "Explain the vanishing gradient problem to a beginner.", "As error signals travel back through many layers, they get multiplied by small numbers repeatedly and shrink to near zero, preventing early layers from learning."),
                     ]},
                    {"id": "ai-2-3", "title": "Dropout Regularization", "desc": "Preventing overfitting with random deactivation.",
                     "stages": [
                         _mc("Dropout", "What does dropout do during training?", [{"id":"a","text":"Adds more neurons"},{"id":"b","text":"Randomly deactivates neurons"},{"id":"c","text":"Increases learning rate"},{"id":"d","text":"Removes layers"}], "b"),
                         _order("Dropout", "Order the dropout process:", ["During training, randomly select neurons", "Set selected neurons output to zero", "Scale remaining outputs", "At inference, use all neurons"]),
                         _match("Dropout", [{"id":"p1","left":"Dropout rate 0.5","right":"50% neurons deactivated"},{"id":"p2","left":"L2 Regularization","right":"Penalizes large weights"},{"id":"p3","left":"Early Stopping","right":"Stop when validation loss rises"},{"id":"p4","left":"Data Augmentation","right":"Artificially expand training set"}]),
                     ]},
                    {"id": "ai-2-4", "title": "Batch Normalization", "desc": "Stabilizing training with normalization layers.",
                     "stages": [
                         _explain("Batch Normalization", "Normalizing Activations", "Batch normalization normalizes the inputs to each layer, making training more stable and allowing higher learning rates.", ["Applied before or after activation", "Uses running mean/variance at inference"]),
                         _mc("Batch Norm", "Batch normalization operates on which dimension?", [{"id":"a","text":"Each feature across the batch"},{"id":"b","text":"Each sample independently"},{"id":"c","text":"The entire dataset"},{"id":"d","text":"Only the output layer"}], "a"),
                         _feynman("Batch Normalization", "Explain batch normalization in simple terms.", "BatchNorm standardizes each layer's inputs to have zero mean and unit variance across the mini-batch, which speeds up training and reduces sensitivity to initialization."),
                     ]},
                    {"id": "ai-2-5", "title": "Learning Rate Scheduling", "desc": "Dynamically adjusting the learning rate.",
                     "stages": [
                         _mc("LR Scheduling", "What does a learning rate scheduler do?", [{"id":"a","text":"Keeps LR constant"},{"id":"b","text":"Adjusts LR during training"},{"id":"c","text":"Removes LR entirely"},{"id":"d","text":"Doubles LR each epoch"}], "b"),
                         _match("LR Scheduling", [{"id":"p1","left":"Step Decay","right":"Reduce LR every N epochs"},{"id":"p2","left":"Cosine Annealing","right":"Smoothly decrease then increase LR"},{"id":"p3","left":"Warmup","right":"Gradually increase LR at start"},{"id":"p4","left":"ReduceOnPlateau","right":"Reduce LR when metric stalls"}]),
                         _order("LR Scheduling", "Order these from highest to lowest typical initial learning rate:", ["SGD (0.1)", "Adam (0.001)", "Fine-tuning (0.00001)", "Warmup start (0.0)"]),
                     ]},
                    {"id": "ai-2-6", "title": "Transfer Learning", "desc": "Leveraging pre-trained models.",
                     "stages": [
                         _explain("Transfer Learning", "Standing on Giants", "Transfer learning uses a model pre-trained on a large dataset and fine-tunes it for a new, smaller dataset.", ["Saves compute and data", "Common in vision and NLP"]),
                         _mc("Transfer Learning", "In transfer learning, which layers are typically frozen?", [{"id":"a","text":"Output layers"},{"id":"b","text":"Early/feature extraction layers"},{"id":"c","text":"All layers"},{"id":"d","text":"No layers"}], "b"),
                         _order("Transfer Learning", "Order the transfer learning workflow:", ["Select a pre-trained model", "Freeze early layers", "Replace the final classification head", "Fine-tune on your dataset"]),
                     ]},
                ],
            },
            {
                "unitId": "ai-u3", "unitTitle": "Modern Architectures",
                "unitDescription": "CNNs, RNNs, Transformers and beyond.",
                "nodes": [
                    {"id": "ai-3-1", "title": "Convolutional Neural Networks", "desc": "Kernels, pooling, and spatial learning.",
                     "stages": [
                         _explain("CNNs", "Seeing Patterns", "CNNs use small learnable filters that slide across images to detect features like edges, textures, and objects.", ["Convolution → Activation → Pooling", "Translation invariant"]),
                         _mc("CNNs", "What does a pooling layer do?", [{"id":"a","text":"Learns new features"},{"id":"b","text":"Reduces spatial dimensions"},{"id":"c","text":"Adds more channels"},{"id":"d","text":"Normalizes inputs"}], "b"),
                         _match("CNNs", [{"id":"p1","left":"Convolution","right":"Feature detection"},{"id":"p2","left":"Max Pooling","right":"Downsampling"},{"id":"p3","left":"Flatten","right":"Convert 2D to 1D"},{"id":"p4","left":"Fully Connected","right":"Classification head"}]),
                     ]},
                    {"id": "ai-3-2", "title": "Recurrent Neural Networks", "desc": "Handling sequential data.",
                     "stages": [
                         _mc("RNNs", "RNNs are designed for what type of data?", [{"id":"a","text":"Tabular"},{"id":"b","text":"Sequential"},{"id":"c","text":"Graph"},{"id":"d","text":"Static images"}], "b"),
                         _order("RNNs", "Order the RNN evolution:", ["Vanilla RNN", "LSTM", "GRU", "Transformer"]),
                         _feynman("RNNs", "Explain why vanilla RNNs struggle with long sequences.", "Vanilla RNNs process one token at a time and maintain a hidden state, but gradients vanish over many time steps, making it hard to remember early inputs. LSTMs solve this with gating mechanisms."),
                     ]},
                    {"id": "ai-3-3", "title": "The Transformer", "desc": "Attention is all you need.",
                     "stages": [
                         _explain("Transformers", "Attention Revolution", "Transformers process all tokens in parallel using self-attention, where each token attends to every other token to build contextual representations.", ["No recurrence needed", "Scales better than RNNs"]),
                         _mc("Transformers", "What are the three vectors in self-attention?", [{"id":"a","text":"Input, Output, Hidden"},{"id":"b","text":"Query, Key, Value"},{"id":"c","text":"Mean, Variance, Scale"},{"id":"d","text":"Weight, Bias, Gradient"}], "b"),
                         _match("Transformers", [{"id":"p1","left":"Query","right":"What am I looking for?"},{"id":"p2","left":"Key","right":"What do I contain?"},{"id":"p3","left":"Value","right":"What information do I provide?"},{"id":"p4","left":"Attention Score","right":"Dot product of Q and K"}]),
                     ]},
                    {"id": "ai-3-4", "title": "GPT & Language Models", "desc": "Autoregressive text generation.",
                     "stages": [
                         _mc("GPT", "GPT models are trained using which objective?", [{"id":"a","text":"Image classification"},{"id":"b","text":"Next token prediction"},{"id":"c","text":"Clustering"},{"id":"d","text":"Reinforcement"}], "b"),
                         _order("GPT", "Order the GPT model sizes (smallest to largest):", ["GPT-1 (117M)", "GPT-2 (1.5B)", "GPT-3 (175B)", "GPT-4 (estimated >1T)"]),
                         _feynman("GPT", "Explain how GPT generates text.", "GPT predicts the next most likely token given all previous tokens, then appends it and repeats. This autoregressive process generates fluent text one token at a time."),
                     ]},
                    {"id": "ai-3-5", "title": "Vision Transformers (ViT)", "desc": "Applying transformers to images.",
                     "stages": [
                         _explain("ViT", "Patches as Tokens", "Vision Transformers split images into fixed-size patches, flatten them into sequences, and process them with standard transformer encoders.", ["16×16 patches are common", "Competes with CNNs on large datasets"]),
                         _mc("ViT", "How does ViT convert an image into a sequence?", [{"id":"a","text":"Pixel by pixel"},{"id":"b","text":"Splits into patches"},{"id":"c","text":"Random sampling"},{"id":"d","text":"Edge detection"}], "b"),
                         _match("ViT", [{"id":"p1","left":"ViT","right":"Patch-based image transformer"},{"id":"p2","left":"ResNet","right":"Deep CNN with skip connections"},{"id":"p3","left":"CLIP","right":"Vision-language alignment"},{"id":"p4","left":"DALL-E","right":"Text-to-image generation"}]),
                     ]},
                    {"id": "ai-3-6", "title": "Diffusion Models", "desc": "Generative AI through denoising.",
                     "stages": [
                         _explain("Diffusion Models", "From Noise to Art", "Diffusion models learn to reverse a gradual noising process, starting from pure noise and iteratively denoising to generate realistic data.", ["Forward: add noise step by step", "Reverse: learn to remove noise"]),
                         _order("Diffusion Models", "Order the diffusion model process:", ["Start with clean data", "Gradually add Gaussian noise", "Train model to predict and remove noise", "Generate new data by denoising from pure noise"]),
                         _mc("Diffusion Models", "What do diffusion models learn to predict?", [{"id":"a","text":"The original image directly"},{"id":"b","text":"The noise added at each step"},{"id":"c","text":"Image labels"},{"id":"d","text":"Pixel colors"}], "b"),
                     ]},
                ],
            },
        ],
    },
    {
        "title": "Python Fundamentals",
        "topic": "Python Programming Basics",
        "description": "Master Python from variables and loops to object-oriented programming and file I/O.",
        "units": [
            {
                "unitId": "py-u1", "unitTitle": "Basics & Data Types",
                "unitDescription": "Variables, types, and basic operations.",
                "nodes": [
                    {"id": "py-1-1", "title": "Variables & Assignment", "desc": "Storing and naming data in Python.",
                     "stages": [_explain("Variables", "Naming Things", "Variables in Python are names that point to objects in memory. Use `=` to assign.", ["Dynamic typing: no need to declare type", "snake_case convention"]), _mc("Variables", "Which is a valid Python variable name?", [{"id":"a","text":"2name"},{"id":"b","text":"my_var"},{"id":"c","text":"class"},{"id":"d","text":"my-var"}], "b"), _feynman("Variables", "Explain Python variables vs variables in math.", "In math, a variable represents an unknown. In Python, a variable is a label pointing to an object stored in memory—you can reassign it at any time.")]},
                    {"id": "py-1-2", "title": "Numbers & Arithmetic", "desc": "int, float, and mathematical operators.",
                     "stages": [_mc("Numbers", "What is the result of 7 // 2 in Python?", [{"id":"a","text":"3.5"},{"id":"b","text":"3"},{"id":"c","text":"4"},{"id":"d","text":"Error"}], "b"), _match("Numbers", [{"id":"p1","left":"//","right":"Floor division"},{"id":"p2","left":"**","right":"Exponentiation"},{"id":"p3","left":"%","right":"Modulo (remainder)"},{"id":"p4","left":"/","right":"True division"}]), _order("Numbers", "Order by operator precedence (highest first):", ["** (exponent)", "* / // % (mult/div)", "+ - (add/sub)", "= (assignment)"])]},
                    {"id": "py-1-3", "title": "Strings", "desc": "Text manipulation and formatting.",
                     "stages": [_explain("Strings", "Text in Python", "Strings are immutable sequences of characters. Use quotes, f-strings for formatting, and slicing for substrings.", ["f'Hello {name}'", "'hello'[1:4] → 'ell'"]), _mc("Strings", "What does 'hello'[1:3] return?", [{"id":"a","text":"'hel'"},{"id":"b","text":"'el'"},{"id":"c","text":"'ell'"},{"id":"d","text":"'he'"}], "b"), _match("Strings", [{"id":"p1","left":".upper()","right":"HELLO"},{"id":"p2","left":".split()","right":"List of words"},{"id":"p3","left":".strip()","right":"Remove whitespace"},{"id":"p4","left":".replace()","right":"Substitute text"}])]},
                    {"id": "py-1-4", "title": "Lists", "desc": "Ordered mutable sequences.",
                     "stages": [_mc("Lists", "Which method adds an element to the end of a list?", [{"id":"a","text":".add()"},{"id":"b","text":".append()"},{"id":"c","text":".insert()"},{"id":"d","text":".push()"}], "b"), _order("Lists", "Order these list operations by what they do:", [".append() — add to end", ".insert(0, x) — add to start", ".pop() — remove last", ".clear() — remove all"]), _feynman("Lists", "Explain the difference between a list and a tuple.", "Lists are mutable ordered sequences (can add/remove/change elements), while tuples are immutable (cannot be changed after creation). Tuples use parentheses, lists use brackets.")]},
                    {"id": "py-1-5", "title": "Dictionaries", "desc": "Key-value data structures.",
                     "stages": [_explain("Dicts", "Key-Value Pairs", "Dictionaries store data as key-value pairs with O(1) lookup. Keys must be hashable.", ["d = {'name': 'Alice', 'age': 30}", "Access: d['name'] or d.get('name')"]), _mc("Dicts", "What happens when you access a missing key with d['x']?", [{"id":"a","text":"Returns None"},{"id":"b","text":"Returns 0"},{"id":"c","text":"KeyError"},{"id":"d","text":"Creates the key"}], "c"), _match("Dicts", [{"id":"p1","left":".keys()","right":"All keys"},{"id":"p2","left":".values()","right":"All values"},{"id":"p3","left":".items()","right":"Key-value pairs"},{"id":"p4","left":".get(k, default)","right":"Safe access"}])]},
                    {"id": "py-1-6", "title": "Sets & Booleans", "desc": "Unique collections and truth values.",
                     "stages": [_mc("Sets", "What is the result of {1,2,3} & {2,3,4}?", [{"id":"a","text":"{1,2,3,4}"},{"id":"b","text":"{2,3}"},{"id":"c","text":"{1,4}"},{"id":"d","text":"Error"}], "b"), _match("Sets", [{"id":"p1","left":"&","right":"Intersection"},{"id":"p2","left":"|","right":"Union"},{"id":"p3","left":"-","right":"Difference"},{"id":"p4","left":"^","right":"Symmetric difference"}]), _order("Sets", "Order these from falsy to truthy in Python:", ["None", "0", "'' (empty string)", "'hello' (non-empty)"])]},
                ],
            },
            {
                "unitId": "py-u2", "unitTitle": "Control Flow & Functions",
                "unitDescription": "Conditionals, loops, and reusable functions.",
                "nodes": [
                    {"id": "py-2-1", "title": "If/Elif/Else", "desc": "Conditional branching.",
                     "stages": [_explain("Conditionals", "Making Decisions", "Python uses if/elif/else for branching. Conditions must be boolean expressions.", ["Indentation defines blocks", "elif = else if"]), _mc("Conditionals", "What prints? x=5; print('big' if x>3 else 'small')", [{"id":"a","text":"big"},{"id":"b","text":"small"},{"id":"c","text":"5"},{"id":"d","text":"Error"}], "a"), _order("Conditionals", "Order the conditional evaluation:", ["Check if condition", "If True, execute if block", "Else check elif conditions", "If all False, execute else block"])]},
                    {"id": "py-2-2", "title": "For Loops", "desc": "Iterating over sequences.",
                     "stages": [_mc("For Loops", "How many times does 'for i in range(5):' loop?", [{"id":"a","text":"4"},{"id":"b","text":"5"},{"id":"c","text":"6"},{"id":"d","text":"Infinite"}], "b"), _match("For Loops", [{"id":"p1","left":"range(5)","right":"0,1,2,3,4"},{"id":"p2","left":"range(2,5)","right":"2,3,4"},{"id":"p3","left":"range(0,10,2)","right":"0,2,4,6,8"},{"id":"p4","left":"range(5,0,-1)","right":"5,4,3,2,1"}]), _feynman("For Loops", "Explain enumerate() and when to use it.", "enumerate() wraps an iterable and yields (index, value) pairs, so you get both the position and the element without managing a counter variable manually.")]},
                    {"id": "py-2-3", "title": "While Loops", "desc": "Repeating until a condition is met.",
                     "stages": [_explain("While Loops", "Loop Until Done", "While loops repeat as long as a condition is True. Always ensure the condition eventually becomes False!", ["Use break to exit early", "Use continue to skip iteration"]), _mc("While Loops", "What can cause an infinite loop?", [{"id":"a","text":"Forgetting to update the counter"},{"id":"b","text":"Using break"},{"id":"c","text":"Using range()"},{"id":"d","text":"Using continue"}], "a"), _order("While Loops", "Order the while loop execution:", ["Evaluate condition", "If True, execute body", "Update loop variable", "Go back to step 1"])]},
                    {"id": "py-2-4", "title": "Functions (def)", "desc": "Defining and calling reusable code.",
                     "stages": [_mc("Functions", "What does a function without a return statement return?", [{"id":"a","text":"0"},{"id":"b","text":"''"},{"id":"c","text":"None"},{"id":"d","text":"Error"}], "c"), _match("Functions", [{"id":"p1","left":"def","right":"Define a function"},{"id":"p2","left":"return","right":"Send value back"},{"id":"p3","left":"*args","right":"Variable positional args"},{"id":"p4","left":"**kwargs","right":"Variable keyword args"}]), _feynman("Functions", "Explain the difference between parameters and arguments.", "Parameters are the variable names in the function definition. Arguments are the actual values passed when calling the function.")]},
                    {"id": "py-2-5", "title": "Lambda & Map/Filter", "desc": "Functional programming basics.",
                     "stages": [_explain("Lambda", "Anonymous Functions", "Lambda creates small anonymous functions inline: lambda x: x*2. Often used with map() and filter().", ["map(func, iterable) → apply func to each", "filter(func, iterable) → keep if True"]), _mc("Lambda", "What is the output of list(map(lambda x: x**2, [1,2,3]))?", [{"id":"a","text":"[1,4,9]"},{"id":"b","text":"[2,4,6]"},{"id":"c","text":"[1,2,3]"},{"id":"d","text":"Error"}], "a"), _order("Lambda", "Order from simplest to most complex:", ["lambda x: x", "lambda x: x*2", "lambda x,y: x+y", "def func(x): ..."])]},
                    {"id": "py-2-6", "title": "List Comprehensions", "desc": "Concise list creation syntax.",
                     "stages": [_mc("Comprehensions", "What does [x for x in range(5) if x%2==0] produce?", [{"id":"a","text":"[0,2,4]"},{"id":"b","text":"[1,3]"},{"id":"c","text":"[0,1,2,3,4]"},{"id":"d","text":"[2,4]"}], "a"), _match("Comprehensions", [{"id":"p1","left":"[x for x in L]","right":"List comprehension"},{"id":"p2","left":"{x for x in L}","right":"Set comprehension"},{"id":"p3","left":"{k:v for k,v in d}","right":"Dict comprehension"},{"id":"p4","left":"(x for x in L)","right":"Generator expression"}]), _feynman("Comprehensions", "Explain when to use a list comprehension vs a for loop.", "Use comprehensions for simple transformations that produce a new list. Use for loops for complex logic, side effects, or when readability suffers from a one-liner.")]},
                ],
            },
            {
                "unitId": "py-u3", "unitTitle": "OOP & File I/O",
                "unitDescription": "Object-oriented programming and file handling.",
                "nodes": [
                    {"id": "py-3-1", "title": "Classes & Objects", "desc": "Defining custom types.",
                     "stages": [_explain("Classes", "Blueprints for Objects", "A class defines attributes and methods. Objects are instances of classes.", ["class Dog: ...", "my_dog = Dog()"]), _mc("Classes", "What is __init__ used for?", [{"id":"a","text":"Deleting objects"},{"id":"b","text":"Initializing attributes"},{"id":"c","text":"Printing objects"},{"id":"d","text":"Importing modules"}], "b"), _order("Classes", "Order the OOP workflow:", ["Define a class", "Write __init__ method", "Add methods", "Create instances"])]},
                    {"id": "py-3-2", "title": "Inheritance", "desc": "Extending classes.",
                     "stages": [_mc("Inheritance", "What does super() do?", [{"id":"a","text":"Creates a new class"},{"id":"b","text":"Calls the parent class method"},{"id":"c","text":"Deletes a class"},{"id":"d","text":"Copies a class"}], "b"), _match("Inheritance", [{"id":"p1","left":"Inheritance","right":"Child extends parent"},{"id":"p2","left":"Polymorphism","right":"Same interface, different behavior"},{"id":"p3","left":"Encapsulation","right":"Hide internal details"},{"id":"p4","left":"Abstraction","right":"Simplify complex systems"}]), _feynman("Inheritance", "Explain method resolution order (MRO).", "MRO determines the order Python searches for methods in inheritance hierarchies, typically using C3 linearization to ensure each class appears once.")]},
                    {"id": "py-3-3", "title": "Exception Handling", "desc": "try/except for robust code.",
                     "stages": [_explain("Exceptions", "Graceful Failures", "Use try/except to catch errors. finally always runs. raise to throw custom exceptions.", ["try: → except: → finally:", "Catch specific exceptions first"]), _mc("Exceptions", "Which block always executes?", [{"id":"a","text":"try"},{"id":"b","text":"except"},{"id":"c","text":"finally"},{"id":"d","text":"raise"}], "c"), _order("Exceptions", "Order the exception handling flow:", ["try block executes", "If error, jump to except", "Matching except block runs", "finally block always runs"])]},
                    {"id": "py-3-4", "title": "File I/O", "desc": "Reading and writing files.",
                     "stages": [_mc("File I/O", "Which mode opens a file for reading?", [{"id":"a","text":"'w'"},{"id":"b","text":"'r'"},{"id":"c","text":"'a'"},{"id":"d","text":"'x'"}], "b"), _match("File I/O", [{"id":"p1","left":"'r'","right":"Read only"},{"id":"p2","left":"'w'","right":"Write (overwrite)"},{"id":"p3","left":"'a'","right":"Append"},{"id":"p4","left":"'rb'","right":"Read binary"}]), _feynman("File I/O", "Explain why 'with open()' is preferred over open()/close().", "The 'with' statement creates a context manager that automatically closes the file when the block ends, even if an exception occurs, preventing resource leaks.")]},
                    {"id": "py-3-5", "title": "Modules & Imports", "desc": "Organizing code across files.",
                     "stages": [_explain("Modules", "Code Organization", "Modules are .py files you can import. Packages are directories with __init__.py.", ["import math", "from os import path"]), _mc("Modules", "What does __name__ == '__main__' check?", [{"id":"a","text":"If file is imported"},{"id":"b","text":"If file is run directly"},{"id":"c","text":"If file exists"},{"id":"d","text":"If file is empty"}], "b"), _order("Modules", "Order Python's module search path:", ["Current directory", "PYTHONPATH directories", "Standard library", "Site-packages"])]},
                    {"id": "py-3-6", "title": "Decorators", "desc": "Functions that modify functions.",
                     "stages": [_explain("Decorators", "Wrapping Functions", "A decorator is a function that takes another function and extends its behavior. Use @decorator syntax.", ["@timer\ndef func(): ...", "Common: @property, @staticmethod"]), _mc("Decorators", "What does @staticmethod do?", [{"id":"a","text":"Makes method async"},{"id":"b","text":"Removes self parameter"},{"id":"c","text":"Makes method private"},{"id":"d","text":"Caches results"}], "b"), _feynman("Decorators", "Explain how decorators work under the hood.", "When you write @my_decorator above a function, Python replaces: func = my_decorator(func). The decorator returns a wrapper that can add logic before/after calling the original function.")]},
                ],
            },
        ],
    },
    {
        "title": "World History",
        "topic": "World History from Ancient Civilizations to the Modern Era",
        "description": "Journey through human history from Mesopotamia to the digital age.",
        "units": [
            {
                "unitId": "wh-u1", "unitTitle": "Ancient Civilizations",
                "unitDescription": "The birth of civilization and early empires.",
                "nodes": [
                    {"id": "wh-1-1", "title": "Mesopotamia", "desc": "The cradle of civilization.",
                     "stages": [_explain("Mesopotamia", "Between the Rivers", "Mesopotamia, located between the Tigris and Euphrates rivers, gave rise to the first cities, writing (cuneiform), and legal codes.", ["Sumer, Akkad, Babylon, Assyria", "Hammurabi's Code ~1750 BCE"]), _mc("Mesopotamia", "What writing system did the Sumerians develop?", [{"id":"a","text":"Hieroglyphics"},{"id":"b","text":"Cuneiform"},{"id":"c","text":"Alphabet"},{"id":"d","text":"Kanji"}], "b"), _match("Mesopotamia", [{"id":"p1","left":"Sumer","right":"First cities ~3500 BCE"},{"id":"p2","left":"Babylon","right":"Hammurabi's Code"},{"id":"p3","left":"Assyria","right":"Military empire"},{"id":"p4","left":"Persia","right":"Cyrus the Great"}])]},
                    {"id": "wh-1-2", "title": "Ancient Egypt", "desc": "The Nile civilization.",
                     "stages": [_mc("Egypt", "The Great Pyramid was built for which pharaoh?", [{"id":"a","text":"Tutankhamun"},{"id":"b","text":"Khufu"},{"id":"c","text":"Ramesses II"},{"id":"d","text":"Cleopatra"}], "b"), _order("Egypt", "Order the Egyptian periods:", ["Old Kingdom (pyramids)", "Middle Kingdom (expansion)", "New Kingdom (empire)", "Ptolemaic Period (Greek rule)"]), _feynman("Egypt", "Explain the importance of the Nile River to Egyptian civilization.", "The Nile's annual flooding deposited fertile silt for agriculture, provided water for irrigation, served as a transportation highway, and defined the rhythm of Egyptian life and calendar.")]},
                    {"id": "wh-1-3", "title": "Ancient Greece", "desc": "Democracy, philosophy, and the arts.",
                     "stages": [_explain("Greece", "The Greek World", "Ancient Greece pioneered democracy, philosophy, theater, and the Olympic games. City-states like Athens and Sparta shaped Western civilization.", ["Athenian democracy ~508 BCE", "Socrates, Plato, Aristotle"]), _mc("Greece", "Which city-state is known for its military culture?", [{"id":"a","text":"Athens"},{"id":"b","text":"Corinth"},{"id":"c","text":"Sparta"},{"id":"d","text":"Thebes"}], "c"), _match("Greece", [{"id":"p1","left":"Socrates","right":"Questioning method"},{"id":"p2","left":"Plato","right":"Theory of Forms"},{"id":"p3","left":"Aristotle","right":"Logic & natural philosophy"},{"id":"p4","left":"Herodotus","right":"Father of History"}])]},
                    {"id": "wh-1-4", "title": "Roman Empire", "desc": "From republic to empire.",
                     "stages": [_mc("Rome", "When did the Western Roman Empire fall?", [{"id":"a","text":"27 BCE"},{"id":"b","text":"476 CE"},{"id":"c","text":"1453 CE"},{"id":"d","text":"330 CE"}], "b"), _order("Rome", "Order Roman history:", ["Roman Kingdom", "Roman Republic", "Roman Empire", "Fall of Western Rome"]), _match("Rome", [{"id":"p1","left":"Julius Caesar","right":"Assassinated 44 BCE"},{"id":"p2","left":"Augustus","right":"First Emperor"},{"id":"p3","left":"Constantine","right":"Legalized Christianity"},{"id":"p4","left":"Romulus Augustulus","right":"Last Western Emperor"}])]},
                    {"id": "wh-1-5", "title": "Han Dynasty China", "desc": "The Silk Road empire.",
                     "stages": [_explain("Han Dynasty", "The Silk Road", "The Han Dynasty (206 BCE – 220 CE) expanded the Silk Road, established the civil service exam, and invented paper.", ["Confucianism became state ideology", "Population ~60 million"]), _mc("Han Dynasty", "What major trade route was expanded during the Han Dynasty?", [{"id":"a","text":"Spice Route"},{"id":"b","text":"Silk Road"},{"id":"c","text":"Amber Road"},{"id":"d","text":"Trans-Saharan"}], "b"), _feynman("Han Dynasty", "Explain the significance of the Chinese civil service examination system.", "The exam system selected government officials based on merit rather than birth, promoting Confucian education and creating a professional bureaucracy that persisted for centuries.")]},
                    {"id": "wh-1-6", "title": "Maurya & Gupta India", "desc": "The golden age of Indian civilization.",
                     "stages": [_mc("India", "Who founded the Maurya Empire?", [{"id":"a","text":"Ashoka"},{"id":"b","text":"Chandragupta Maurya"},{"id":"c","text":"Samudragupta"},{"id":"d","text":"Harsha"}], "b"), _match("India", [{"id":"p1","left":"Ashoka","right":"Spread Buddhism"},{"id":"p2","left":"Gupta Empire","right":"Golden Age of India"},{"id":"p3","left":"Aryabhata","right":"Mathematics & astronomy"},{"id":"p4","left":"Kalidasa","right":"Sanskrit literature"}]), _order("India", "Order these Indian developments:", ["Vedic period", "Maurya Empire", "Gupta Golden Age", "Delhi Sultanate"])]},
                ],
            },
            {
                "unitId": "wh-u2", "unitTitle": "Medieval & Early Modern",
                "unitDescription": "Feudalism, renaissance, and exploration.",
                "nodes": [
                    {"id": "wh-2-1", "title": "The Medieval Period", "desc": "Feudalism and the Church.",
                     "stages": [_explain("Medieval", "The Middle Ages", "After Rome's fall, Europe entered a feudal period where lords, vassals, and serfs structured society under the Catholic Church's influence.", ["Feudal hierarchy: King → Lords → Knights → Peasants", "Monasteries preserved knowledge"]), _mc("Medieval", "Feudalism is based on the exchange of what?", [{"id":"a","text":"Money for goods"},{"id":"b","text":"Land for loyalty/service"},{"id":"c","text":"Technology for resources"},{"id":"d","text":"Religion for power"}], "b"), _match("Medieval", [{"id":"p1","left":"Charlemagne","right":"Holy Roman Empire"},{"id":"p2","left":"Black Death","right":"1347-1351"},{"id":"p3","left":"Magna Carta","right":"1215"},{"id":"p4","left":"Crusades","right":"1096-1291"}])]},
                    {"id": "wh-2-2", "title": "The Renaissance", "desc": "Rebirth of art and learning.",
                     "stages": [_mc("Renaissance", "The Renaissance began in which country?", [{"id":"a","text":"France"},{"id":"b","text":"England"},{"id":"c","text":"Italy"},{"id":"d","text":"Spain"}], "c"), _match("Renaissance", [{"id":"p1","left":"Leonardo da Vinci","right":"Mona Lisa"},{"id":"p2","left":"Michelangelo","right":"Sistine Chapel"},{"id":"p3","left":"Gutenberg","right":"Printing press"},{"id":"p4","left":"Copernicus","right":"Heliocentric model"}]), _feynman("Renaissance", "Explain why the Renaissance started in Italy.", "Italy's wealth from trade, city-state competition, classical Roman heritage, patronage by families like the Medici, and influx of Greek scholars after Constantinople's fall all combined to spark the Renaissance.")]},
                    {"id": "wh-2-3", "title": "Age of Exploration", "desc": "European voyages across the globe.",
                     "stages": [_order("Exploration", "Order these explorations:", ["Columbus reaches Americas (1492)", "Vasco da Gama reaches India (1498)", "Magellan circumnavigates (1519)", "Cook reaches Australia (1770)"]), _mc("Exploration", "Who funded Columbus's voyage?", [{"id":"a","text":"England"},{"id":"b","text":"Portugal"},{"id":"c","text":"Spain"},{"id":"d","text":"France"}], "c"), _explain("Exploration", "Why Explore?", "European powers sought new trade routes, resources, and territories. The 'Columbian Exchange' transferred crops, animals, and diseases between hemispheres.", ["Gold, God, Glory", "Devastating effect on indigenous populations"])]},
                    {"id": "wh-2-4", "title": "The Reformation", "desc": "Martin Luther and religious change.",
                     "stages": [_mc("Reformation", "In what year did Luther post his 95 Theses?", [{"id":"a","text":"1492"},{"id":"b","text":"1517"},{"id":"c","text":"1543"},{"id":"d","text":"1648"}], "b"), _match("Reformation", [{"id":"p1","left":"Luther","right":"95 Theses"},{"id":"p2","left":"Calvin","right":"Predestination"},{"id":"p3","left":"Henry VIII","right":"Church of England"},{"id":"p4","left":"Counter-Reformation","right":"Council of Trent"}]), _feynman("Reformation", "Explain the main causes of the Protestant Reformation.", "Corruption in the Catholic Church (indulgences, simony), the printing press spreading new ideas, rising nationalism, and reformers like Luther questioning papal authority all drove the Reformation.")]},
                    {"id": "wh-2-5", "title": "The Enlightenment", "desc": "Reason and individual rights.",
                     "stages": [_explain("Enlightenment", "The Age of Reason", "Enlightenment thinkers championed reason, science, and individual rights, challenging absolute monarchy and church authority.", ["Locke: natural rights", "Montesquieu: separation of powers"]), _mc("Enlightenment", "Who wrote 'The Social Contract'?", [{"id":"a","text":"Locke"},{"id":"b","text":"Voltaire"},{"id":"c","text":"Rousseau"},{"id":"d","text":"Montesquieu"}], "c"), _match("Enlightenment", [{"id":"p1","left":"Voltaire","right":"Freedom of speech"},{"id":"p2","left":"Locke","right":"Life, liberty, property"},{"id":"p3","left":"Rousseau","right":"Social contract"},{"id":"p4","left":"Adam Smith","right":"Free market economics"}])]},
                    {"id": "wh-2-6", "title": "The French Revolution", "desc": "Liberty, equality, fraternity.",
                     "stages": [_order("French Rev", "Order the French Revolution events:", ["Storming of the Bastille (1789)", "Declaration of Rights of Man", "Reign of Terror (1793-94)", "Rise of Napoleon (1799)"]), _mc("French Rev", "What was the Reign of Terror?", [{"id":"a","text":"Economic boom"},{"id":"b","text":"Period of mass executions"},{"id":"c","text":"Religious reform"},{"id":"d","text":"Colonial expansion"}], "b"), _feynman("French Rev", "Explain the causes of the French Revolution.", "The causes include financial crisis from war debt, unfair taxation of the Third Estate, food shortages, Enlightenment ideas about equality, and the rigid class system that denied commoners political power.")]},
                ],
            },
            {
                "unitId": "wh-u3", "unitTitle": "Modern World",
                "unitDescription": "Industrialization to the information age.",
                "nodes": [
                    {"id": "wh-3-1", "title": "Industrial Revolution", "desc": "The transformation of production.",
                     "stages": [_explain("Industrial Rev", "Machines Change Everything", "Starting in Britain ~1760, mechanized production transformed economies from agrarian to industrial.", ["Steam engine, spinning jenny, railways", "Urbanization and labor movements"]), _mc("Industrial Rev", "The Industrial Revolution began in which country?", [{"id":"a","text":"France"},{"id":"b","text":"Germany"},{"id":"c","text":"Britain"},{"id":"d","text":"USA"}], "c"), _match("Industrial Rev", [{"id":"p1","left":"James Watt","right":"Steam engine"},{"id":"p2","left":"Eli Whitney","right":"Cotton gin"},{"id":"p3","left":"Henry Ford","right":"Assembly line"},{"id":"p4","left":"Edison","right":"Electric light bulb"}])]},
                    {"id": "wh-3-2", "title": "World War I", "desc": "The Great War 1914-1918.",
                     "stages": [_mc("WWI", "What event triggered WWI?", [{"id":"a","text":"Sinking of Lusitania"},{"id":"b","text":"Assassination of Archduke Franz Ferdinand"},{"id":"c","text":"German invasion of Poland"},{"id":"d","text":"Russian Revolution"}], "b"), _order("WWI", "Order WWI events:", ["Assassination of Franz Ferdinand (1914)", "US enters the war (1917)", "Russian Revolution (1917)", "Armistice signed (1918)"]), _feynman("WWI", "Explain the system of alliances that led to WWI.", "Europe was divided into the Triple Alliance (Germany, Austria-Hungary, Italy) and Triple Entente (France, Russia, Britain). When one nation was attacked, treaties pulled allies in, turning a regional conflict into a world war.")]},
                    {"id": "wh-3-3", "title": "World War II", "desc": "The global conflict 1939-1945.",
                     "stages": [_explain("WWII", "Total War", "WWII was the deadliest conflict in history, involving most of the world's nations in two opposing alliances: the Allies and the Axis.", ["~70-85 million deaths", "Holocaust: 6 million Jews murdered"]), _mc("WWII", "D-Day invasion landed on the beaches of which region?", [{"id":"a","text":"Sicily"},{"id":"b","text":"Normandy"},{"id":"c","text":"Dunkirk"},{"id":"d","text":"Okinawa"}], "b"), _order("WWII", "Order WWII events:", ["Germany invades Poland (1939)", "Pearl Harbor (1941)", "D-Day (1944)", "Atomic bombs dropped (1945)"])]},
                    {"id": "wh-3-4", "title": "The Cold War", "desc": "Superpower rivalry 1947-1991.",
                     "stages": [_mc("Cold War", "What was the Iron Curtain?", [{"id":"a","text":"A physical wall"},{"id":"b","text":"Ideological division of Europe"},{"id":"c","text":"Military strategy"},{"id":"d","text":"Trade agreement"}], "b"), _match("Cold War", [{"id":"p1","left":"NATO","right":"Western military alliance"},{"id":"p2","left":"Warsaw Pact","right":"Eastern bloc alliance"},{"id":"p3","left":"Cuban Missile Crisis","right":"1962 nuclear standoff"},{"id":"p4","left":"Berlin Wall","right":"Fell in 1989"}]), _feynman("Cold War", "Explain why the Cold War never became a 'hot' war between superpowers.", "Nuclear deterrence (MAD - Mutually Assured Destruction) prevented direct conflict between the US and USSR. Instead, they fought proxy wars and competed in arms races, space races, and ideology.")]},
                    {"id": "wh-3-5", "title": "Decolonization", "desc": "The end of European empires.",
                     "stages": [_explain("Decolonization", "New Nations Rise", "After WWII, European empires crumbled as colonies demanded independence, reshaping the global political map.", ["India 1947, Ghana 1957", "UN membership grew from 51 to 193"]), _mc("Decolonization", "Who led India's nonviolent independence movement?", [{"id":"a","text":"Nehru"},{"id":"b","text":"Jinnah"},{"id":"c","text":"Gandhi"},{"id":"d","text":"Bose"}], "c"), _order("Decolonization", "Order these independence dates:", ["India (1947)", "Ghana (1957)", "Algeria (1962)", "Zimbabwe (1980)"])]},
                    {"id": "wh-3-6", "title": "The Digital Revolution", "desc": "Computers, internet, and the modern world.",
                     "stages": [_mc("Digital Rev", "The World Wide Web was invented by whom?", [{"id":"a","text":"Bill Gates"},{"id":"b","text":"Steve Jobs"},{"id":"c","text":"Tim Berners-Lee"},{"id":"d","text":"Vint Cerf"}], "c"), _order("Digital Rev", "Order the digital milestones:", ["First computer (ENIAC, 1945)", "Personal computer era (1980s)", "World Wide Web (1991)", "iPhone launched (2007)"]), _match("Digital Rev", [{"id":"p1","left":"ARPANET","right":"Precursor to the internet"},{"id":"p2","left":"HTTP","right":"Web protocol"},{"id":"p3","left":"Google","right":"Search engine (1998)"},{"id":"p4","left":"Bitcoin","right":"Cryptocurrency (2009)"}])]},
                ],
            },
        ],
    },
]


# ---------------------------------------------------------------------------
# Database seeding logic
# ---------------------------------------------------------------------------

def _get_or_create_system_user(db: Session) -> UserModel:
    """Find or create the system user that owns all public courses."""
    user = db.query(UserModel).filter(UserModel.email == SYSTEM_EMAIL).first()
    if user is None:
        user = UserModel(
            email=SYSTEM_EMAIL,
            full_name=SYSTEM_NAME,
            hashed_password="!system-no-login",
            credits=999999,
            xp=0,
            level=1,
            xp_to_next_level=100,
        )
        db.add(user)
        db.flush()
        print(f"  Created system user: {SYSTEM_EMAIL} (id={user.id})")
    return user


def _build_syllabus_json(course_def: dict) -> dict:
    """Build the syllabus_json for a course, marking first node available."""
    units = []
    first_node = True
    for unit_def in course_def["units"]:
        nodes = []
        for node_def in unit_def["nodes"]:
            nodes.append({
                "id": node_def["id"],
                "title": node_def["title"],
                "description": node_def["desc"],
                "status": "available" if first_node else "locked",
                "hasGeneratedLesson": True,
            })
            first_node = False
        units.append({
            "unitId": unit_def["unitId"],
            "unitTitle": unit_def["unitTitle"],
            "unitDescription": unit_def["unitDescription"],
            "nodes": nodes,
        })
    return {
        "courseTitle": course_def["title"],
        "description": course_def["description"],
        "units": units,
    }


def _seed_one_course(db: Session, user: UserModel, course_def: dict) -> None:
    title = course_def["title"]

    # Upsert: delete existing to allow re-seeding
    existing = db.query(CourseModel).filter(
        CourseModel.user_id == user.id,
        CourseModel.title == title,
    ).first()
    if existing:
        print(f"    Overwriting existing course: {title} (id={existing.id})")
        db.delete(existing)
        db.flush()

    syllabus = _build_syllabus_json(course_def)
    course = CourseModel(
        user_id=user.id,
        title=title,
        topic=course_def["topic"],
        status=CourseStatus.READY,
        folder_name=str(uuid.uuid4()),
        profile_json={"summary": "System-generated public course."},
        draft_json={"topic": course_def["topic"]},
        syllabus_json=syllabus,
    )
    db.add(course)
    db.flush()

    node_count = 0
    stage_count = 0
    now = utc_now_naive()

    for unit_def in course_def["units"]:
        for node_def in unit_def["nodes"]:
            is_first = node_def["id"] == course_def["units"][0]["nodes"][0]["id"]
            node_status = NodeStatus.AVAILABLE if is_first else NodeStatus.LOCKED

            db_node = NodeModel(
                course_id=course.id,
                node_id=node_def["id"],
                title=node_def["title"],
                status=node_status,
                data={"description": node_def["desc"]},
            )
            db.add(db_node)
            node_count += 1

            # Create Lesson
            lesson = LessonModel(
                user_id=user.id,
                course_id=course.id,
                node_id=node_def["id"],
                course_topic=course_def["topic"],
                status="generated",
                stage_count=len(node_def["stages"]),
                question_count=len(node_def["stages"]),
                estimated_duration_minutes=len(node_def["stages"]) * 3,
                schema_version=2,
                generator_provider="seed-script",
                generator_model="seed-public-courses",
                created_at=now,
                updated_at=now,
            )
            db.add(lesson)
            db.flush()

            # Create LessonStages
            for idx, stage_def in enumerate(node_def["stages"]):
                stage_model = LessonStageModel(
                    lesson_id=lesson.id,
                    stage_uid=stage_def["stageId"],
                    stage_order=idx,
                    stage_type="interactive",
                    topic=stage_def["topic"],
                    skin=stage_def["skin"],
                    component=stage_def["component"],
                    difficulty=stage_def.get("difficulty"),
                    recommended_duration_minutes=stage_def.get("recommendedDurationMinutes"),
                    item_count=1,
                    schema_version=2,
                    content_json=stage_def["config"],
                    validation_json={"type": stage_def["validation"]["type"], "condition": stage_def["validation"]["condition"]},
                    feedback_json=stage_def["feedback"],
                    stage_snapshot_json=stage_def,
                    created_at=now,
                    updated_at=now,
                )
                db.add(stage_model)
                stage_count += 1

    db.commit()
    print(f"    ✓ {title}: {node_count} nodes, {stage_count} stages (course_id={course.id})")


def main() -> None:
    db = SessionLocal()
    try:
        print("Seeding public courses...")
        system_user = _get_or_create_system_user(db)
        db.commit()

        for course_def in COURSES:
            _seed_one_course(db, system_user, course_def)

        print(f"\nDone! {len(COURSES)} public courses seeded under {SYSTEM_EMAIL}.")
        print("System user ID:", system_user.id)
    finally:
        db.close()


if __name__ == "__main__":
    main()
