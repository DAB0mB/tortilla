var Chai = require('chai');


var expect = Chai.expect;


describe('Manual', function () {
  describe('convert()', function () {
    this.slow(5000);

    beforeEach(function () {
      for (let step = 1; step <= 3; step++) {
        const manualPath = 'steps/step' + step + '.md';
        const manual = '# Step ' + step;

        this.npm.step(['tag', '-m', 'dummy']);
        this.npm.step(['edit', step]);
        this.exec('bash', ['-c', 'echo "' + manual + '" > ' + manualPath]);
        this.git(['add', manualPath]);
        this.git(['commit', '--amend'], { GIT_EDITOR: true });
        this.git(['rebase', '--continue']);
      }
    });

    it('should convert a specified manual file to production format', function () {
      this.npm.step(['edit', '2']);
      this.npm.manual(['convert', '2']);
      this.git(['rebase', '--continue']);

      const manual = this.exec('cat', ['steps/step2.md']);
      expect(manual).to.be.a.markdown('prod-manuals/steps/step2');
    });

    it('should convert a specified manual file to development format', function () {
      this.npm.step(['edit', '2']);
      this.npm.manual(['convert', '2']);
      this.npm.manual(['convert', '2']);
      this.git(['rebase', '--continue']);

      const manual = this.exec('cat', ['steps/step2.md']);
      expect(manual).to.be.a.markdown('dev-manuals/steps/step2');
    });

    it('should convert all manual files through out history to production format', function () {
      const manualsPaths = [
        'README.md',
        'steps/step1.md',
        'steps/step2.md',
        'steps/step3.md'
      ];

      this.npm.manual(['convert', '--all']);

      manualsPaths.forEach(function (manualPath) {
        const manual = this.exec('cat', [manualPath]);
        expect(manual).to.be.a.file('prod-manuals/' + manualPath);
      }, this);
    });

    it('should convert all manual markdowns through out history to development format', function () {
      const manualsPaths = [
        'README.md',
        'steps/step1.md',
        'steps/step2.md',
        'steps/step3.md'
      ];

      this.npm.manual(['convert', '--all']);
      this.npm.manual(['convert', '--all']);

      manualsPaths.forEach(function (manualPath) {
        const manual = this.exec('cat', [manualPath]);
        expect(manual).to.be.a.file('dev-manuals/' + manualPath);
      }, this);
    });
  });
});