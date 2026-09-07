module.exports=[{
 id:'cyber-adversarial-training',title:'Adversarial training: inner input search, outer parameter update',
 overrides:{rankSpacing:28,nodeSpacing:24,wrappingWidth:230},
 requiredText:['Freeze θ and y','Freeze candidate inputs','Update θ once'],
 source:`flowchart TD
 B["Batch x, y<br/>Declare allowed perturbations"] --> I["Freeze θ and y<br/>Search over input changes"]
 I --> C["Freeze candidate inputs<br/>Evaluate the chosen loss"]
 C --> U["Update θ once<br/>Parameter-gradient step"]
 U --> N["Next batch or epoch"]
 style I stroke:#B83D2D`,
 caption:'One iteration of the stated training recipe. The inner search changes inputs; the outer step changes parameters. Neither arrow means that a finite attack found the worst case or that training certified the resulting network. An optional clean/adversarial loss mixture is evaluated at the same parameters before the single update.'
},{
 id:'cyber-smoothing-certify',title:'Randomized smoothing: select, estimate, bound, certify or abstain',
 overrides:{rankSpacing:28,nodeSpacing:24,wrappingWidth:230},
 requiredText:['Freeze chosen class','Independent n samples','pLower > 0.5?','ABSTAIN','L₂ radius'],
 source:`flowchart TD
 S["n₀ noisy evaluations<br/>Select candidate class"] --> F["Freeze chosen class"]
 F --> E["Independent n samples<br/>Count chosen class: k"]
 E --> L["One-sided lower bound<br/>pLower from k, n, α"]
 L --> Q{"pLower > 0.5?"}
 Q -->|"yes"| R["Chosen class + L₂ radius<br/>R = σ Φ⁻¹(pLower)"]
 Q -->|"no"| A["ABSTAIN<br/>No positive radius returned"]
 style A stroke:#B83D2D`,
 caption:'The same fixed base classifier f, input x and Gaussian standard deviation σ are used in both sample batches. Selection and estimation use independent draws; do not select a new winner from the estimation batch. The radius concerns the smoothed classifier g, not f. Counts in the worked examples below are invented, not experimental image predictions.'
}];
