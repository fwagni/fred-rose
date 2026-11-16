-- Exemple : les trois temps de la journée du 13 février 2027 (heure de Douala, UTC+1).
-- À exécuter après schema.sql, puis à ajuster depuis l'espace administrateur.
insert into public.events (title_fr, title_en, starts_at, ends_at, venue_name, address, map_url, notes_fr, notes_en, sort_order) values
('Cérémonie civile', 'Civil ceremony', '2027-02-13 10:00+01', '2027-02-13 11:00+01',
 'Jardin du CFPE', 'Centre de Formation Professionnel de l''Excellence, Ndogbat (après l''INSAM), Douala',
 'https://www.google.com/maps/search/?api=1&query=Ndogbat+Douala',
 'Merci d''arriver à 9h30 pour l''accueil. Le jardin est à droite en entrant.',
 'Please arrive at 9:30 am. The garden is on the right as you enter.', 1),
('Discours biblique', 'Bible talk', '2027-02-13 14:30+01', '2027-02-13 15:15+01',
 'Salle du Royaume des Témoins de Jéhovah', 'Face Bocom, quartier Brazzaville, Douala',
 'https://www.google.com/maps/search/?api=1&query=Brazzaville+Douala',
 'Un bus part du CFPE à 13h00. Prévoyez la circulation.',
 'A bus leaves the CFPE at 1:00 pm. Allow for traffic.', 2),
('Soirée de mariage', 'Wedding reception', '2027-02-13 18:30+01', '2027-02-13 22:30+01',
 'Jardin du CFPE', 'Centre de Formation Professionnel de l''Excellence, Ndogbat (après l''INSAM), Douala',
 'https://www.google.com/maps/search/?api=1&query=Ndogbat+Douala',
 'Accueil à partir de 17h30. Votre numéro de table figure sur votre invitation.',
 'Welcome from 5:30 pm. Your table number is shown on your invitation.', 3);
