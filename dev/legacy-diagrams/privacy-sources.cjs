// Evidence-backed distinctions; this file does not run an attack or an LLM.
const sources={
  quantifying:'https://arxiv.org/html/2202.07646v3',
  membership:'https://arxiv.org/abs/1610.05820',
  inversion:'https://www.cs.cmu.edu/~mfredrik/papers/fjr2015ccs.pdf',
  extraction:'https://www.usenix.org/conference/usenixsecurity21/presentation/carlini-extracting',
  injection:'https://arxiv.org/abs/2302.12173'
};
const diagram={id:'cyber-privacy-provenance',title:'Training data and live context are different information paths',
  source:`flowchart TB
D["Training corpus D"] --> T["Training / fine-tuning"]
T --> W["Trained weights θ"]
W --> G["Generation fθ(context)"]
C["Live context<br/>Prompt / retrieved records"] --> G
G --> O["Reply or tool arguments"]
O --> E["Assess recipient + authorization"]
style E stroke:#B83D2D
linkStyle 5 stroke:#B83D2D`,
  overrides:{nodeSpacing:40,rankSpacing:40,wrappingWidth:280},
  requiredText:['Training corpus D','Training / fine-tuning','Trained weights θ','Live context','Generation fθ(context)','Reply or tool arguments','Assess recipient + authorization'],
  caption:'Information paths, not a guarantee of copying or disclosure. In this fixed-weight inference example, live context reaches generation without updating θ. A reply or tool argument may contain training-derived or session-provided information, both, or an incorrect invention. The last step checks what was actually sent, to whom, and under which authorization; red marks the assessment boundary, not a measured breach.'};
const threats=[
  {id:'membership',name:'Membership inference',target:'Whether a candidate record belonged to the training set.',access:'Can use prediction queries after training; weights are not required in the Shokri et al. black-box setting.',limit:'An inference can be wrong. Evaluate members and non-members with explicit sampling and false-positive rates; non-member does not mean out-of-distribution.',ref:'membership'},
  {id:'inversion',name:'Model inversion / attribute inference',target:'Unknown input features or a class-associated representation.',access:'Depends on the attack. Fredrikson et al. exploit prediction confidence and auxiliary information, including black-box settings.',limit:'A recognizable reconstructed face need not be an exact stored photograph. Inversion is not a general inverse of training and does not itself establish membership.',ref:'inversion'},
  {id:'extraction',name:'Training-data extraction',target:'Recover particular training content, for example a verbatim sequence.',access:'May use a trained model through generation queries. Carlini et al. demonstrated extraction from GPT-2.',limit:'Validate provenance and the extraction criterion. Generated personal-looking text is not automatically a true secret or a verified training record.',ref:'extraction'},
  {id:'context',name:'Live-context disclosure',target:'Information supplied in the conversation or retrieved at runtime.',access:'Illustrative case: an application forwards a confidential record in a search query.',limit:'No training on that record is required. A tool call is a disclosure violation only when its data and recipient fall outside the applicable authorization.'},
  {id:'inference',name:'Inference from released fragments',target:'An undisclosed fact deduced using output and auxiliary information.',access:'Illustrative case: combine a released location and rare attribute with a public directory.',limit:'Report the evidence and uncertainty of the inference, not just a plausible story. This need not involve model memorization.'},
  {id:'injection',name:'Prompt injection',target:'Make the application follow attacker-controlled instructions contrary to its intended policy.',access:'An attempted runtime manipulation, for example instructions embedded in an untrusted retrieved document.',limit:'An attempt is not guaranteed to override instructions. It can seek disclosure or other unauthorized actions; it is not synonymous with all privacy leakage.',ref:'injection'}
];
const cases=[
  {id:'witness',setup:'A known training sequence is split into prefix p and withheld suffix s. Only p is supplied; greedy generation reproduces s.',conclusion:'A witness for extractability under the stated prefix-only test.',limit:'Does not alone prove that s is confidential, that an attacker knows p, or that this is the only cause of the output.'},
  {id:'context-copy',setup:'A new confidential string is supplied in the context and appears in a tool argument.',conclusion:'The trace shows context-to-output disclosure of that string.',limit:'Not evidence that the string was learned during training. Check the actual tool recipient and authorization.'},
  {id:'unknown-origin',setup:'An output looks like a personal record, but its source and truth have not been checked.',conclusion:'Provenance remains unverified.',limit:'It may be invented, public, context-derived or training-derived; appearance alone cannot decide.'},
  {id:'miss',setup:'One tested prefix does not reproduce the chosen training suffix.',conclusion:'No extraction witness for that particular test.',limit:'Not proof that the model forgot the record or that other prompts, access modes or attacks cannot reveal information.'}
];
module.exports={sources,diagram,threats,cases};
