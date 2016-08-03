# stats.py -<file>
import json
import sys

if __name__ == '__main__':
	trainingFileName = sys.argv[1]
	numPrograms = 0
	totalFeatures = 0
	totalNodes = 0

	with open(trainingFileName, "r") as trainingFile:
		for line in trainingFile:
			try:
				line = line.rstrip('\n')
				singleProgramObject = json.loads(line)
				query = singleProgramObject['query']
				assign = singleProgramObject['assign']
				totalFeatures += len(query)
				totalNodes += len(assign)
				numPrograms += 1
			except:
				continue
	print "Average number of features per program: " + str(float(totalFeatures)/numPrograms)
	print "Average number of nodes per program: " + str(float(totalNodes)/numPrograms)
	print "Total programs: " + str(numPrograms)