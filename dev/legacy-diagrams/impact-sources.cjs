const sources={
 eykholt:'https://arxiv.org/pdf/1707.08945v5',
 sharif:'https://users.cs.northwestern.edu/~srutib/papers/face-rec-ccs16.pdf',
 medical:'https://arxiv.org/pdf/1804.05296v3',
 grosse:'https://arxiv.org/pdf/1606.04435',
 ban:'https://www.techscience.com/CMES/v139n3/55641/html',
 carlini:'https://nicholas.carlini.com/papers/2018_dls_audioadvex.pdf',
 chen:'https://openaccess.thecvf.com/content/CVPR2022W/ArtOfRobust/html/Chen_The_Risk_and_Opportunity_of_Adversarial_Example_in_Military_Field_CVPRW_2022_paper.html',
 gazit:'https://arxiv.org/abs/2512.20712v4',
 zhu:'https://www.usenix.org/conference/usenixsecurity23/presentation/zhu'
};
const rows=[
 {id:'road',domain:'Road-sign perception',refs:['eykholt'],observed:'Eykholt et al.: physical stickers and posters attacked road-sign classifiers. The LISA-CNN drive-by test used sampled, cropped frames; its camouflage-art result was 84.8% targeted misclassification as Speed Limit 45.',limit:'A frame-level classifier rate is not a crash rate. This does not establish transfer across vehicle models, failure of a complete driving stack, or an observed injury.'},
 {id:'face',domain:'Facial recognition',refs:['sharif'],observed:'Sharif et al.: printed eyeglass frames enabled dodging or impersonation in the evaluated face-recognition systems, including physical tests with three subjects.',limit:'Printed glasses are visible objects. Recognition errors do not by themselves establish access to a building, wrongful arrest or identity theft.'},
 {id:'medical',domain:'Medical image classification',refs:['medical'],observed:'Finlayson et al.: digital attacks on their ResNet-50 classifiers for diabetic retinopathy, pneumothorax and melanoma, using public image datasets.',limit:'These are model evaluations, not reports of patients receiving wrong treatment. MRI tumor detection is not one of these three experiments.'},
 {id:'malware',domain:'Malware detection',refs:['grosse','ban'],observed:'Grosse et al.: Android/DREBIN feature additions restricted to manifest-derived features. Ban et al. (2024): a separate study of Windows PE binaries and static malware detectors.',limit:'Do not combine these into “add bytes to an Android APK, 85% success.” Evasion rates depend on model, samples and denominator; detector evasion does not prove execution, compromise or data theft.'},
 {id:'biometric',domain:'Biometric authentication',refs:['sharif'],observed:'This overlaps the face-recognition example, rather than adding an independent experiment. Sharif et al. distinguish classification success from success at an acceptance threshold.',limit:'Identification and verification are different decisions. Authentication additionally depends on the claimed identity, threshold, presentation checks and other factors; a top-ranked wrong identity is not sufficient evidence of access.'},
 {id:'speech',domain:'Speech recognition',refs:['carlini'],observed:'Carlini & Wagner (2018): white-box targeted transcription attacks on Mozilla DeepSpeech with direct digital waveform input. Their reported examples did not remain adversarial after over-the-air playback.',limit:'This does not demonstrate an inaudible commercial-assistant command, cross-model transfer, an unlocked door or an actual intrusion. The slide’s “Call 911 → Open the door” is not used here as a measured result.'},
 {id:'drone',domain:'Drone / military systems',refs:['chen','gazit'],observed:'Chen (2022) discusses conceptual military deception and simulations. Gazit et al. (v4, 2026) evaluate RF-based drone detection using spectrograms, including over-the-air tests.',limit:'Neither cited result substantiates the slide’s “school bus → military convoy” casualty narrative. RF drone detection is not an onboard camera identifying ground vehicles.'},
 {id:'signal',domain:'Triggered sensor attacks',refs:['zhu'],observed:'The slide’s linked paper is Zhu et al. (2023), TPatch—not Zhou. It combines a printed patch with acoustic-induced camera distortion to conditionally affect detection or classification.',limit:'The patch does not become physically invisible or receive a radio command. Triggered sensor distortion changes the captured input; this is not evidence of a poisoned-model backdoor or a demonstrated road collision.'}
];
const diagram={id:'cyber-model-to-impact',title:'From manipulated input to system outcome: separate evidence at each stage',overrides:{rankSpacing:26,nodeSpacing:26,wrappingWidth:230},requiredText:['Physical change','Sensor channel','Digital input change','Model output','Application controls','Outcome assessment'],source:`flowchart TD
 P["Physical change<br/>Object or signal"] --> S["Sensor channel<br/>Capture and environment"]
 S --> X["Input processing"]
 D["Digital input change"] --> X
 X --> M["Model output<br/>Measure prediction error"]
 M -.-> A{"Application controls<br/>What action follows?"}
 A -->|"reject / review"| B["No automatic action<br/>Review may still fail"]
 A -->|"accept"| U["Application action"]
 B --> O
 U --> O["Outcome assessment<br/>Measure actual consequences"]
 style M stroke:#B83D2D`,caption:'Schematic evaluation stages, not measured probabilities. Digital and physical tests enter through different paths. The dashed link marks an evidence gap: a model error alone does not establish the application’s response. Controls may block, defer or accept an action; neither a review branch nor an accepted action proves safety or harm. Evaluate the complete system and its outcomes separately.'};
module.exports={sources,rows,diagram};
