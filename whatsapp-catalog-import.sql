-- Parts Market: WhatsApp Business Catalog import
-- Run once in Supabase SQL Editor. All imported products start with stock 0.
-- Prices are copied only where visible in the supplied screenshots; otherwise 0.
-- Images are left NULL because the screenshots contain small collage thumbnails, not original product photos.

insert into public.categories (name, parent_name)
select 'WhatsApp Catalog', null
where not exists (select 1 from public.categories where name = 'WhatsApp Catalog');

with catalog(name, price, compatibility, description) as (
  values
  ('Gpx demon Arrow X and triple bubble visor',0,'GPX','Premium Quality'),
  ('New SF Carbon JDM visor black/white',0,'Suzuki SF','Premium Quality'),
  ('Hand gloves',0,'Universal',''),
  ('Miter shield / protector available for all bikes',0,'R15 / Gixxer / SF / Xtreme',''),
  ('RTR engine kit for all bike (Universal)',0,'Universal','Premium Quality'),
  ('Universal engine kit (+ Clam free) for all bikes',0,'Universal','Premium Quality'),
  ('Premium Quality Full engine kit for Gixxer new',0,'Gixxer','Available colors: black, mat black, blue, mat blue silver, red'),
  ('Jomthai chain Sprocket set',0,'R15 / GSXR / CBR / 4V / GPX',''),
  ('Footrest extender / Riser for Gixxer / SF and TVS 4V',0,'Gixxer / SF / TVS 4V',''),
  ('Carbon wings mirror for body kit bikes',0,'Body kit bikes','Body kit bike new ZX10R mirror available at store'),
  ('New SF Twin Visor black and white',0,'Suzuki SF','Premium Quality'),
  ('New SF Nosemask',0,'Suzuki SF','Suzuki SF New Model Headmask; all colours available at store'),
  ('Gixxer Fiber Engine kit for Gixxer all naked bikes',0,'Gixxer','Colours: Black, Blue, White, Merun, Mat blue, Mat black'),
  ('Mokila S1 master cylinder and clutch',0,'Universal','Premium Quality best quality product'),
  ('New SF JDM visor black/white',0,'Suzuki SF','Premium Quality'),
  ('New SF arrow x visor white/Black',0,'Suzuki SF','Premium Quality'),
  ('R15 v4, R15M Arrow X visor white / black',0,'R15 V4 / R15M','Premium Quality'),
  ('Universal Indicators mirror',0,'Universal','All body kit bike universal indicators mirror available'),
  ('Gixxer engine kit',0,'Gixxer SF','SF old model engine kit for all naked Gixxer model bikes'),
  ('Body kit DRL apps controller 210 modes',2300,'Body kit bikes',''),
  ('R15M, R15V4 3mm Premium Quality Indo visor black',0,'R15M / R15 V4',''),
  ('R15V4, R15M 3mm Premium Quality Arrow X visor black',0,'R15M / R15 V4',''),
  ('R15V4, R15M 3mm Premium Quality Arrow S visor white',0,'R15M / R15 V4','Premium Quality'),
  ('New SF/SF250 3mm Premium Quality Arrow X visor',0,'SF / SF250',''),
  ('New SF Premium quality Arrow X twin Visor',0,'Suzuki SF',''),
  ('CNC carbon mudguard colour black and silver',0,'Universal',''),
  ('Number plate emboss (3D)',300,'Universal',''),
  ('Number plate steel plate with sticker prints',250,'Universal',''),
  ('100% Stainless Steel Number Plate with 3D letters',600,'Universal',''),
  ('CNC alloy suspension fork cover universal use on all bikes',3200,'Universal',''),
  ('R15 v4, R15M Carbon fog winglet',0,'R15 V4 / R15M',''),
  ('USD Suspension cover (Made in Indonesia)',2200,'Universal','Universal fitting for all bikes'),
  ('R15V4 R15M Premium quality China rainbow (Multi colour)',0,'R15 V4 / R15M',''),
  ('CNC black diamond khamchi Universal',1800,'Universal','Full CNC machine aluminium alloy material'),
  ('YRC Crown For R15M, v3 Indonesia version',0,'R15M / R15 V3',''),
  ('R15 V4 / M visor',0,'R15 V4 / R15M',''),
  ('Vortex wings for R15 v2, v3, v4, M',0,'R15 V2 / V3 / V4 / M',''),
  ('Old SF JDM Visor',0,'Suzuki SF','Premium Quality Made with Pakistani sheet'),
  ('Old SF twin Visor white and black',0,'Suzuki SF','Premium Quality Made with Pakistani 3mm sheet'),
  ('Old SF long Corsa visor Black/White',0,'Suzuki SF','Premium Quality Made with Pakistani 3mm sheet'),
  ('SYRC Engine clutch spinner',0,'Universal','Made with high quality aluminium material'),
  ('SYRC CNC slider for R15V4 R15M',0,'R15 V4 / R15M',''),
  ('SYRC CNC Chasis extension (Swing arm extender)',0,'Universal',''),
  ('HJG security alarm system',0,'Universal',''),
  ('Engine bumpers / crash guard for all bikes',0,'Universal',''),
  ('SYRC CNC hose holder',600,'Universal','')
)
insert into public.products
  (name, price, category, stock, compatibility, description, active)
select c.name, c.price, 'WhatsApp Catalog', 0, c.compatibility, c.description, true
from catalog c
where not exists (
  select 1 from public.products p
  where lower(trim(p.name)) = lower(trim(c.name))
);
