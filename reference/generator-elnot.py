import json
import os
import random
import string

DETAILS = '''
ELNOT
Some example formats are: ANNNA, ANNNN, or NNNNN with the first example being most common.
'''
NOTES = '''
Unfortunately, this is the first I came across to be somewhat classified. To be safe, I'll say it's a 5 character unique ID for radar, determined by emissions. 
'''

ITEM_NAME = 'elnot'

def generate_item():
    choice_weighted = [
        (3, random.choice(string.ascii_uppercase) + ''.join(random.choices(string.digits, k=3)) + random.choice(string.ascii_uppercase)), # ANNNA most common
        (1, random.choice(string.ascii_uppercase) + ''.join(random.choices(string.digits, k=4))), # ANNNN
        (1, ''.join(random.choices(string.digits, k=5))) # NNNNN
    ]
    weights, patterns = zip(*choice_weighted)
    item = random.choices(patterns, weights=weights, k=1)[0]
    return item

def generate_dataset(n=5000):
    items = list()
    for _ in range(n):
        item = generate_item()
        item_data = {'name': ITEM_NAME, ITEM_NAME: item}
        items.append(item_data)
    return items

if __name__ == "__main__":
    items = generate_dataset(n=5000)
    unique = set()

    name = 'ELNOT'
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
        'info': f'A {name} is a 5 character alphanumeric unique ID that can contain leading zeroes for a radar system, determined by emissions.',
        'endnote': 'Do not mention leading zeros. Respond only with a sentence, no other comments or decoration. Answer correctly and explain the reasoning for the answer.', 
        'prompt_templates': prompt_templates,
        'completion_template': f'$info\n$details\nRespond to the following sentence about a {name}: "$prompt"\nThe {name} $item is the correct length, it is valid and correctly formatted.\n$endnote',
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
