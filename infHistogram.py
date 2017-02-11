# infHistogram.py -<file> [--include_giv]
import json
import sys
import re
from collections import Counter, OrderedDict

def strip(word):
    lower = word.lower()
    stripped = re.sub(r'[^a-zA-Z]','', lower)
    if (len(stripped) == 0):
        return lower
    return stripped


if __name__ == '__main__':
    trainingFileName = sys.argv[1]
    histogram = {}
    include_giv = False
    if (len(sys.argv) > 2 and sys.argv[2] == '--include_giv'):
        include_giv = True

    with open(trainingFileName, "r") as trainingFile:
        for line in trainingFile:
            line = line.rstrip('\n')
            try:
                singleProgramObject = json.loads(line)
            except ValueError:
                continue
            assign = singleProgramObject['assign']
            for varItem in assign:
                if (varItem.has_key('inf')):
                    name = strip(varItem['inf'])
                    if histogram.has_key(name):
                        histogram[name] += 1
                    else:
                        histogram[name] = 1
                elif (varItem.has_key('giv') and include_giv):
                    name = strip(varItem['giv'])
                    if histogram.has_key(name):
                        histogram[name] += 1
                    else:
                        histogram[name] = 1
                       
    top = dict(Counter(histogram))
    sortedTopValues = OrderedDict(sorted(top.items(), key=lambda t: t[1], reverse=True))
    for key,value in sortedTopValues.items():
        print str(key) + "," + str(value)