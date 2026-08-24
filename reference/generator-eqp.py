import json
import os
import random
import string

DETAILS = '''
Equipment Code
Also known as: EqpCode, EQP_CODE, and EQPCODE.
From the DASEE website (I don’t know how we got this). It explains the significance of the first letter in an equipment code:
A - Aircraft - Fixed Wing
B - Aircraft - Rotary Wing
C - Naval Ships - Combatant Ship Category
D - Naval Ships - Combatant Craft Category
E - Naval Ships - Auxiliary Ship Category
F - Naval Ships - Support Craft Category
G - Merchant/Fishing/Research/Special Purpose and Other Non-Military Ships
H - Optics
J - Engines & Propulsion Systems
K - Space Objects Equipment & Launch Vehicles
L - Associated/Miscellaneous Equipment
M - Antitank Weapons
N - Armored Vehicles
O - Mortars
P - Tanks
Q - General Purpose Vehicles
R - Special Purpose Vehicles
S - Engineering Equipment
T - Air Defense Weapons
U - Field Artillery/Surface Bombardment Weapons/Torpedo Tubes
V - Surface-to-Surface Missile Launchers
W - Small Arms
X - Radars/Electronic Warfare Equipment & Other Remote Detection Devices
Y - Communications and Automatic Data Processing (ADP) Equipment
Z - Missiles/Ammunition
9 - File Administrative Entries
'''
NOTES = '''
From our MIDB Documentation:
EQP_CODE char(7) Valid equipment codes are determined and maintained by DIA.
Here are some unclass examples from our MEPED dataset. For some reason, they are only 5 characters long instead of the 7-character designation in our MIDB documentation. On the plus side, they all conform to the first-letter convention listed above. The ones I have seen high-side are 5 characters, so let’s stick with that for now.
XMAXQ, MSXFO, ZSBAE, DJT93, XODBV, ZTUA2, JACAE, JAHCQ, XTARJ
We could make a script to read each XML file, and if the eqpcode is marked U for unclass, then pull it into your example dataset.
'''

# Mapping first letter to equipment type
EQP_LETTER_MAPPING = {
    'A': 'Aircraft - Fixed Wing',
    'B': 'Aircraft - Rotary Wing',
    'C': 'Naval Ships - Combatant Ship Category',
    'D': 'Naval Ships - Combatant Craft Category',
    'E': 'Naval Ships - Auxiliary Ship Category',
    'F': 'Naval Ships - Support Craft Category',
    'G': 'Merchant/Fishing/Research/Special Purpose and Other Non-Military Ships',
    'H': 'Optics',
    'J': 'Engines & Propulsion Systems',
    'K': 'Space Objects Equipment & Launch Vehicles',
    'L': 'Associated/Miscellaneous Equipment',
    'M': 'Antitank Weapons',
    'N': 'Armored Vehicles',
    'O': 'Mortars',
    'P': 'Tanks',
    'Q': 'General Purpose Vehicles',
    'R': 'Special Purpose Vehicles',
    'S': 'Engineering Equipment',
    'T': 'Air Defense Weapons',
    'U': 'Field Artillery/Surface Bombardment Weapons/Torpedo Tubes',
    'V': 'Surface-to-Surface Missile Launchers',
    'W': 'Small Arms',
    'X': 'Radars/Electronic Warfare Equipment & Other Remote Detection Devices',
    'Y': 'Communications and Automatic Data Processing (ADP) Equipment',
    'Z': 'Missiles/Ammunition',
    '9': 'File Administrative Entries'
}

FIRST_LETTERS = list(EQP_LETTER_MAPPING.keys())
OTHER_LETTERS = string.ascii_uppercase # e.g., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

ITEM_NAME = 'eqp'

def generate_item():
    first = random.choice(FIRST_LETTERS)
    other_weighted = [
        (3, ''.join(random.choices(string.ascii_uppercase, k=4))),
        (1, ''.join(random.choices(string.ascii_uppercase, k=3)) + random.choice(string.digits)),
        (1, ''.join(random.choices(string.ascii_uppercase, k=2)) + ''.join(random.choices(string.digits, k=2)))
    ]
    
    weights, patterns = zip(*other_weighted)
    other = random.choices(patterns, weights=weights, k=1)[0]
    return first + other

def generate_dataset(n=5000):
    items = list()
    for _ in range(n):
        item = generate_item()
        item_data = {'name': ITEM_NAME, ITEM_NAME: item, 'parsed': {'type': EQP_LETTER_MAPPING[item[0]]}}
        items.append(item_data)
    return items

if __name__ == "__main__":
    items = generate_dataset(n=5000)
    unique = set()

    name = 'Equipment Code'
    prompt_templates = [
        #f'$info\nWrite a sentence in the style of a report that either mentions or asks a question about the following {name}: $item\nInclude the full {name} in the sentence, but do not reference that it is a {name}.\n$endnote',
        #f'$info\nWrite a question sentence that asks to identify the data in some quoted text. The quoted text should be in the style of a report snippet that either mentions or asks a question about the following {name}: $item\nInclude the full {name} in the quoted text, but do not reference that it is a {name}.\n$endnote',
        #f'$info\nWrite a question sentence that asks to parse the data in some quoted text. The quoted text should be in the style of a report snippet that either mentions or asks a question about the following {name}: $item\nInclude the full {name} in the quoted text, but do not reference that it is a {name}.\n$endnote',
        #f'$info\nWrite a question sentence that asks how to parse the data in some quoted text. The quoted text should be in the style of a report snippet that either mentions or asks a question about the following {name}: $item\nInclude the full {name} in the quoted text, but do not reference that it is a {name}.\n$endnote',
        #f'$info\nWrite a question sentence that either asks to identify, parse, or explain $item, which is a {name}.\nInclude the full {name} in the quoted text, but do not reference that it is a {name}.\n$endnote',
        #f'$info\nWrite a question sentence that either asks to identify, parse, or explain $item, which is a {name}.\nInclude the full {name} in the quoted text, but do not reference that it is a {name}.\n$endnote',
        #f'$info\nWrite a question sentence that either asks to identify, parse, or explain $item, which is a {name}.\nInclude the full {name} in the quoted text, but do not reference that it is a {name}.\n$endnote',
        #f'$info\nWrite a question sentence that either asks to identify, parse, or explain $item, which is a {name}.\nInclude the full {name} in the quoted text, but do not reference that it is a {name}.\n$endnote',
        f'$info\nWrite a question sentence that either asks to identify, parse, or explain $item, which is a {name}.\nInclude the full {name} in the quoted text, but do not reference that it is a {name}.\n$endnote',
    ]
    first_line = {
        'info': f'A {name}, also known as EqpCode, EQP_CODE, and EQPCODE, from our MIDB Documentation: Valid equipment codes are determined and maintained by DIA. The Equipment Code is a unique alphanumeric identifier assigned to potential military target equipment in the U.S. Department of Defense\'s targeting database, used for precise reference in intelligence and joint operations.',
        'endnote': 'Respond only with a sentence, no other comments or decoration. Answer correctly and explain the reasoning for the answer.', 
        'prompt_templates': prompt_templates,
        'completion_template': f'$info\n$details\nRespond to the following sentence about a {name}: \"$prompt\"\nThe {name} $item is the correct length, it is valid and correctly formatted and breaks down into the following fields when parsed: $data\nUse that data in your response if it applies.\n$endnote',
        'details': DETAILS
    }

    # create 'synthetic' subdirectory if it doesn't exist
    os.makedirs('synthetic', exist_ok=True)
    # save to JSONL for dataset building
    with open(f'synthetic/synthetic_{ITEM_NAME}.jsonl', 'w') as f:
        f.write(json.dumps(first_line) + '\n')
        for item in items:
            unique.add(item[ITEM_NAME])
            print('ITEM:', item)
            f.write(json.dumps(item) + '\n')
    print(f'ITEMS: {len(items)}')
    print(f'UNIQUE: {len(unique)}')
