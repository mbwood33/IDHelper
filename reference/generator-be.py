import json
import os
import random
import string

DETAILS = '''
BE Number

TARGETING AND THE TARGET 
1.7.3. Fixed Target Identification Data. Because of the great amount of intelligence available, large numbers of potential targets, and a variety of data bases, it is essential to have a standard refer-ence system. Fixed targets are listed, described, and indexed through five basic elements of information, they are: the basic encyclopedia (BE) number, the functional classification code, the target name, the geographic coordinate, and a two- character geopolitical (or country) code. (Refer to the Target Intelligence Handbook [TIHB] [DDB- 2600- 312- YR]).
1.7.3.1. Basic Encyclopedia (BE) Numbers (BEN). For this synthetic generator, the only approved shapes are four digits, two uppercase letters, and four digits; or four digits, a dash, and five digits.
1.7.3.2. Functional Classification Codes. Each installation is classified or categorized to reflect products and military activity supported, etc. They are categorized by a five- digit code, as fol-lows:
1.7.3.2.1. The first digit gives the function in nine major categories. The other four digits show functions within the group. From left to right, each one describes the function or capa-bility of the installation more specifically. A code is assigned to each fixed facility that has some significance. The functional code for a mobile system (e. g., SAM, AAA, GCI, etc.) is assigned to the specific area that the system supports or where the activity is located (rather than the equipment itself). See DIAM 65- 3- 1 for these functional classification codes, com-monly known as category codes.
EXAMPLE: 80052
Airfield, fighter base, primary mission is support of ground attack aircraft. 
1.7.3.3. Installation Names. Because of the many types of installations, coupled with the various name forms and component parts, a specific procedure is used to select and apply installation names. There are seven name components used to identify installations. These components appear in the following order: place name, functional name, distinguishing descriptive terms, proper name, honorary name, underground designation, and installation alpha or numerical desig-nators. However, not all of these names may appear on one installation. (For standard abbrevia-tions and procedures used, see the Target Intelligence Handbook.) CIA and some other sources of installation name do not always use the standard DoD naming scheme; be careful in trying to cor-relate installations based only on the name. The same applies to place names
1.7.3.4. Installation Coordinates. Latitude and longitude coordinates represent the fourth stan-dard element for installation identification. They are reference coordinates only and they are selected by approximating the center of mass for an installation. For airfields, the center of the runway or intersection of major runways is selected. Fields in the MIDB will indicate the source of coordinates (See DDB- 2600- 725- XX, Point Reference Guide Book).
EXAMPLE: 265134N0932402E
1.7.3.5. Geopolitical codes. Geopolitical or country codes are composed of two alpha characters listed in the Target Intelligence Handbook. These codes are used in every installation record as one of the basic identification elements. 13

From our MIDB Documentation:
BE_NUMBER char(10) Uniquely identifies the installation of the facility. The BE_NUMBER is generated based on the value input for the COORD to determine the appropriate World Aeronautical Chart (WAC) location identifier, the system assigned record originator and a one-up-number.
OSUFFIX char(5) Uniquely identifies a facility or demographic area in conjunction with a
BE_NUMBER
WAC char(4) World Aeronautical Chart identifier for the area in which a designated
place is located
After looking at a mountain of highside data, there are only 2 formats for BE numbers:
1234AB1234
4 digits followed by 2 letters, followed by 4 digits
1234-12345
All numeric. 4 digits, then a dash, then 5 digits
There is only one format for OSUFFIX:
AANNN
2 letters followed by 3 digits
The BE_NUMBER and OSUFFIX can be combined into 15 character BE_NUMBER.
'''

def generate_ben():
    if random.choice((True, False)):
        return ''.join(random.choices(string.digits, k=4)) + ''.join(random.choices(string.ascii_uppercase, k=2)) + ''.join(random.choices(string.digits, k=4))
    return ''.join(random.choices(string.digits, k=4)) + '-' + ''.join(random.choices(string.digits, k=5))

def generate_osuffix():
    agency = ''.join(random.choices(string.ascii_uppercase, k=2))
    seq = ''.join(random.choices(string.digits, k=3))
    return agency + seq

# Generate 5000 examples (some with OSUFFIX)
items = []
for _ in range(5000):
    ben = generate_ben()
    if random.random() > 0.5:
        osuffix = generate_osuffix()
        full = ben + ' ' + osuffix
        items.append({'name': 'full', 'ben': ben, 'osuffix': osuffix, 'full': full, 'parsed': {'wac': ben[:4], 'installation': ben[4:], 'osuffix': osuffix, 'agency': osuffix[:2], 'sequential': osuffix[2:]}})
    else:
        full = ben
        items.append({'name': 'full', 'ben': ben, 'full': full, 'parsed': {'wac': ben[:4], 'installation': ben[4:]}})

name = 'BE Number'
prompt_templates = [
    #f'$info\nWrite a sentence in the style of a report that either mentions or asks a question about the following {name}: $item\nInclude the full {name} in the sentence, but do not reference that it is a {name}.\n$endnote',
    #f'$info\nWrite a question sentence that asks to identify the data in some quoted text. The quoted text should be in the style of a report snippet that either mentions or asks a question about the following {name}: $item\nInclude the full {name} in the quoted text, but do not reference that it is a {name}.\n$endnote',
    #f'$info\nWrite a question sentence that asks to parse the data in some quoted text. The quoted text should be in the style of a report snippet that either mentions or asks a question about the following {name}: $item\nInclude the full {name} in the quoted text, but do not reference that it is a {name}.\n$endnote',
    #f'$info\nWrite a question sentence that asks how to parse the data in some quoted text. The quoted text should be in the style of a report snippet that either mentions or asks a question about the following {name}: $item\nInclude the full {name} in the quoted text, but do not reference that it is a {name}.\n$endnote',
    #f'$info\nWrite a question sentence that asks to identify the data in some quoted text. The quoted text should be in the style of a report snippet that either mentions or asks a question about the following {name}: $item\nInclude the full {name} in the quoted text, but do not reference that it is a {name}.\n$endnote',
    #f'$info\nWrite a question sentence that either asks to identify, parse, or explain $item, which is a {name}.\nInclude the full {name} in the quoted text, but do not reference that it is a {name}.\n$endnote',
    #f'$info\nWrite a question sentence that either asks to identify, parse, or explain $item, which is a {name}.\nInclude the full {name} in the quoted text, but do not reference that it is a {name}.\n$endnote',
    #f'$info\nWrite a question sentence that either asks to identify, parse, or explain $item, which is a {name}.\nInclude the full {name} in the quoted text, but do not reference that it is a {name}.\n$endnote',
    #f'$info\nWrite a question sentence that either asks to identify, parse, or explain $item, which is a {name}.\nInclude the full {name} in the quoted text, but do not reference that it is a {name}.\n$endnote',
    f'$info\nWrite a question sentence that either asks to identify, parse, or explain $item, which is a {name}.\nInclude the full {name} in the quoted text, but do not reference that it is a {name}.\n$endnote',
]
first_line = {
    'info': 'A Basic Encyclopedia (BE) Number is a unique alphanumeric identifier (often 10 or 15 characters) that can include leading zeros assigned to potential military targets or installations in the U.S. Department of Defense\'s targeting database (the Basic Encyclopedia, formerly the Bombing Encyclopedia), used for precise reference in intelligence and joint operations.',
    'endnote': 'Do not mention leading zeros. Respond only with a sentence, no other comments or decoration. Answer correctly and explain the reasoning for the answer.', 
    'prompt_templates': prompt_templates,
    'completion_template': f'$info\n$details\nRespond to the following sentence about a {name}: \"$prompt\"\nThe {name} $item is the correct length, it is valid and correctly formatted and breaks down into the following fields when parsed: $data\nUse that data in your response if it applies.\n$endnote',
    'details': DETAILS
}

# create 'synthetic' subdirectory if it doesn't exist
os.makedirs('synthetic', exist_ok=True)
# save to JSONL for dataset building
with open('synthetic/synthetic_ben.jsonl', 'w') as f:
    f.write(json.dumps(first_line) + '\n')
    for item in items:
        print('ITEM:', item)
        f.write(json.dumps(item) + '\n')
    print(f'ITEMS: {len(items)}')
