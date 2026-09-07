module.exports=['cybersecurity','cybersecurity-reworked'].map((course,i)=>({
 id:i?'cyber-reworked-transfer':'cyber-transfer',file:course+'/Cyber-05-AI-Security.html',slot:null,
 title:'Transfer evaluation: the second model has three possible outcomes',
 overrides:{rankSpacing:32,nodeSpacing:22,wrappingWidth:210},
 requiredText:['Freeze x + δ','Targeted success','Untargeted only','Correct label on B'],
 caption:'Conceptual evaluation, not measured network output. Start with the same correctly classified clean input and a chosen target label t different from truth y. Generate a candidate using A only; freeze its pixels before evaluating B. If B predicts t, both targeted and untargeted criteria hold; a different wrong label meets only the untargeted criterion; y meets neither. The diagram is conditional on the declared input constraints and does not promise successful transfer or attach a universal percentage.',
 source:`flowchart TD
 C["Clean x, truth y<br/>A and B predict y"] --> A["Choose t ≠ y<br/>Craft using A only"]
 A --> X["Freeze x + δ<br/>Check input constraints"]
 X --> B["Evaluate unchanged input on B"]
 B -->|"prediction = t"| T["Targeted success<br/>Also untargeted"]
 B -->|"wrong, not t"| U["Untargeted only"]
 B -->|"prediction = y"| N["Correct label on B"]
 style T stroke:#B83D2D
 style U stroke:#B83D2D`
}));
