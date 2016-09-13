# infHistogram.py -<file>
import json
import sys
from collections import Counter, OrderedDict

if __name__ == '__main__':
	trainingFileName = sys.argv[1]
	histogram = {}

	with open(trainingFileName, "r") as trainingFile:
		for line in trainingFile:
			line = line.rstrip('\n')
			singleProgramObject = json.loads(line)
			assign = singleProgramObject['assign']
			for varItem in assign:
				if (varItem.has_key('inf')):
					name = varItem['inf']
					if histogram.has_key(name):
						histogram[name] += 1
					else:
						histogram[name] = 1
                       
	top = dict(Counter(histogram))
	sortedTopValues = OrderedDict(sorted(top.items(), key=lambda t: t[1]))
	for key,value in sortedTopValues.items():
		print str(key) + "," + str(value)