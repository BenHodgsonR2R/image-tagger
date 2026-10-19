// Photos from the COCO dataset whose Flickr pages still showed CC BY 2.0 on 2026-10-19, and one CC0 photo.
// Each theme matches a preset in vocabulary.ts.
export const samples: readonly SampleImage[] = [
  {
    file: "coastal-train.jpg",
    theme: "Travel photo",
    title: "153372",
    author: "didbygraham",
    source: "https://www.flickr.com/photos/didbygraham/8707217553/",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
  },
  {
    file: "airliner.jpg",
    theme: "Travel photo",
    title: "JAL 777",
    author: "Simon_sees",
    source: "https://www.flickr.com/photos/39551170@N02/7733450942/",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
  },
  {
    file: "paris-corner.jpg",
    theme: "Travel photo",
    title: "Carrefour - St. André des Arts",
    author: "Serge Melki",
    source: "https://www.flickr.com/photos/sergemelki/3364389746/",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
  },
  {
    file: "station-crowd.jpg",
    theme: "Travel photo",
    title: "Zürich, Switzerland",
    author: "JasonParis",
    source: "https://www.flickr.com/photos/jasonparis/5495196957/",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
  },
  {
    file: "noodles.jpg",
    theme: "Travel photo",
    title:
      "Pix: Beef strips, broccoli, mushrooms, carrots and udon noodles in Mongolian stir-fry sauce",
    author: "caspiajackmanson",
    source: "https://www.flickr.com/photos/djackmanson/5884430904/",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
  },
  {
    file: "giraffes-at-sunset.jpg",
    theme: "Travel photo",
    title: "200812_kenya-145",
    author: "Ai@ce",
    source: "https://www.flickr.com/photos/aiace/3213959630/",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
  },
  {
    file: "surfer.jpg",
    theme: "Travel photo",
    title: "Manhattan Beach",
    author: "elfidomx",
    source: "https://www.flickr.com/photos/elfidomx/7037849457/",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
  },
  {
    file: "bay.jpg",
    theme: "Travel photo",
    title: "private airplane landing at haf 4",
    author: "stevendamron",
    source: "https://www.flickr.com/photos/sadsnaps/2962435573/",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
  },
  {
    file: "mountain-lake.jpg",
    theme: "Travel photo",
    title: "Clouds mirrored in a mountain lake",
    author: "Ales Krivec",
    source:
      "https://commons.wikimedia.org/wiki/File:Clouds_mirrored_in_a_mountain_lake_(Unsplash).jpg",
    license: "CC0 1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
  {
    file: "kitchen-island.jpg",
    theme: "Property listing",
    title: "Chalon Kitchen",
    author: "ChalonHandmade",
    source: "https://www.flickr.com/photos/chalonuk/6206762667/",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
  },
  {
    file: "kitchen-renovated.jpg",
    theme: "Property listing",
    title: "IMG_0273",
    author: "erocsid",
    source: "https://www.flickr.com/photos/erocsid/6790349696/",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
  },
  {
    file: "bedroom-canopy.jpg",
    theme: "Property listing",
    title:
      "New Orleans - French Quarter - Jackson Square - The 1850 House - Bedroom",
    author: "jared422_80",
    source: "https://www.flickr.com/photos/jared422/7857205982/",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
  },
  {
    file: "bedroom-loft.jpg",
    theme: "Property listing",
    title: "11-30-09",
    author: "idovermani",
    source: "https://www.flickr.com/photos/idovermani/4164666887/",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
  },
  {
    file: "bathroom-blue.jpg",
    theme: "Property listing",
    title: "11 Linnett Close",
    author: "wwarby",
    source: "https://www.flickr.com/photos/wwarby/5818186852/",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
  },
  {
    file: "bathroom-tub.jpg",
    theme: "Property listing",
    title: "Bathroom",
    author: "_Nigel",
    source: "https://www.flickr.com/photos/_nigel/5366234675/",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
  },
  {
    file: "living-room-sofas.jpg",
    theme: "Property listing",
    title: "Living Room",
    author: "meadowbrook19053",
    source: "https://www.flickr.com/photos/meadowbrook19053/6149027966/",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
  },
  {
    file: "living-room-retro.jpg",
    theme: "Property listing",
    title: "basement living 4",
    author: "amy_elizabeth_west",
    source: "https://www.flickr.com/photos/amy_elizabeth_west/4586518760/",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
  },
];

export type SampleImage = {
  file: string;
  theme: string;
  title: string;
  author: string;
  source: string;
  license: string;
  licenseUrl: string;
};

export const sampleThemes = [...new Set(samples.map(({ theme }) => theme))];

export async function loadSample(file: string): Promise<File> {
  const response = await fetch(`samples/${file}`);
  if (!response.ok) {
    throw new Error(`Couldn't load the sample ${file}.`);
  }
  return new File([await response.blob()], file, { type: "image/jpeg" });
}
