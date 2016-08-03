eval10 = 'evaluation_8'
eval0 = 'evaluation_0'

in0 = set()
with open(eval0, "r") as original:
	with open(eval10, "r") as my:
		originalLines = [line.rstrip('\n') for line in original]
		for index,line in enumerate(originalLines):
			if (line.startswith('in file: ')):
				in0.add(line)
				
in10 = set()
with open(eval10, "r") as original:
	with open(eval10, "r") as my:
		originalLines = [line.rstrip('\n') for line in original]
		for index,line in enumerate(originalLines):
			if (line.startswith('in file: ')):
				in10.add(line)
				
print list(in0 - in10)