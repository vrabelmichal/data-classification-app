# Update related to the new catalog and version 0.2 of the classification website  

Dear all,  
There has been a **major update** to the classification website that has been in progress over the past two weeks.

## Updated catalog  
The database was refreshed to the latest catalog version.  
The only change between versions is the configuration of the fitting method – this affects the low‑surface‑brightness (LSB) galaxy candidates shown to reviewers and when a new sequence is generated for a user.  
While updating the catalogs, I also **blacklisted any LSB(G) candidates that don’t appear in the newest catalog**. You should no longer see those objects as candidates for classification. The implementation isn’t perfect yet, so further refinements are planned.

## Updated galaxy images  
Because of the fitting‑method change, I regenerated the images for the modelled galaxies and took the opportunity to **revise the entire set of images shown during classification**.  
APLpy and Lupton composites remain, but the g‑band, residual, and model images have been replaced. The ellipse overlay is also now drawn more accurately, aligning correctly with both the model and g‑band images.  

I expect this will reduce the number of failed fits.  
The timing is unfortunate – many of you have already labelled a lot of objects – but your existing results are still valuable, and we can correct any inconsistencies as galaxies are assigned to new reviewers.

## Mask‑toggle button added  
A new toolbar button lets you switch between **masked and unmasked versions of the images**.  
For now it applies only to g‑band images; let me know if you’d like masks for other image types as well.

## Quick issue reporting  
Next to the mask and overlay toggles is a **new “report issue” button**.  
Click it **four times** to flag a problem (e.g. missing images) with the current galaxy – no explanation is required. 

## Quick‑review interface in the galaxy browser  
You can now browse selected galaxies image‑by‑image.  
Choose the image type you want and use the arrow keys to step through the set.

## Updated help page  
The help page has been reorganised into sections and now includes **more details about the images used in classification**.

